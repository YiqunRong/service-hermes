const axios = require("axios");
const { parse } = require("node-html-parser");
const fs = require("fs");

const accountSid = "accountSid";
const authToken = "authToken";
const client = require("twilio")(accountSid, authToken);

const hermesUrl =
  "https://www.hermes.com/au/en/category/women/bags-and-small-leather-goods/bags-and-clutches/";
const username = "username";
const password = "password";
const proxies = fs
  .readFileSync("proxies.txt", "utf-8")
  .split("\n")
  .map((proxy) => {
    const [ip, port] = proxy.split(":");
    return { ip, port };
  });
const range = proxies.length;

function sleep(n) {
  return new Promise((resolve) => setTimeout(resolve, n));
}

const checkListing = (listing) => {
  const previousData = JSON.parse(fs.readFileSync("results.json", "utf-8"));
  const setPreviousData = new Set(
    previousData.map((item) => JSON.stringify(item))
  );
  const setCurrentListing = new Set(
    listing.map((item) => JSON.stringify(item))
  );
  const difference = [...setCurrentListing].filter(
    (x) => !setPreviousData.has(x)
  );

  return difference.map((jointItem) => JSON.parse(jointItem));
};

const sendSMS = async (message, phoneNumberList) => {
  const sendSMSPromises = phoneNumberList.map((phoneNumber) => {
    return client.messages.create({
      body: message,
      from: "+13204138871",
      to: phoneNumber,
    });
  });
  await Promise.all(sendSMSPromises);
};

const makeHermesRequest = async (pointer) => {
  const response = await axios.get(hermesUrl, {
    proxy: {
      protocol: "http",
      host: proxies[pointer].ip,
      port: proxies[pointer].port,
      auth: {
        username,
        password,
      },
    },
  });
  const document = parse(response.data);
  const results = Array.from(document.querySelectorAll(".product-item")).map(
    (node) => {
      const text = node.innerText.trim().split(">")[1];
      const link = `https://www.hermes.com${
        node.querySelector("a")._attrs.href
      }`;
      return { text, link };
    }
  );
  const diff = checkListing(results);
  console.log(results);
  if (diff.length > 0) {
    const description = diff
      .map((item) => `${item.text} ${item.link}`)
      .join("\n");
    const message = `New Hermes listing, check it out!\n ${description}`;
    await sendSMS(message, ["+61401275503", "+61438881128"]);
  }
  fs.writeFileSync("results.json", JSON.stringify(results, null, 2));
};

const checkHermes = async (pointer, failCounter) => {
  console.log(
    "pointer",
    pointer,
    "failCounter",
    failCounter,
    "timestamp",
    Date.now(),
    "time",
    new Date().toLocaleString()
  );
  try {
    const current = new Date();
    if (current.getHours() >= 9 && current.getHours() <= 18) {  //only check hermes bag listing from 9am to 18pm
      await makeHermesRequest(pointer);
      failCounter = 0;
    } else {
      console.log("not in time range");
    }
  } catch (err) {
    console.log(err.message);
    failCounter++;
  } finally {
    pointer++;
    if (failCounter >= 10) {
      pointer += Math.round(Math.random() * 50);
      failCounter = 0;
    }
    if (pointer >= range) {
      pointer = pointer % range;
    }
    if (failCounter === 0) {
      await sleep(1000);
    }
    checkHermes(pointer, failCounter);
  }
};

checkHermes(Math.round(Math.random() * range), 0);
