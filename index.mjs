import crypto from "crypto";
import qs from "qs";
import fetch from "node-fetch";

const apiUrl = "https://api.kraken.com";
const apiKey = process.env.KRAKEN_API_KEY;
const apiSecret = process.env.KRAKEN_API_SECRET;

const getMessageSignature = (path, request, secret) => {
  const message = qs.stringify(request);
  const secret_buffer = Buffer.from(secret, "base64");
  const hash = new crypto.createHash("sha256");
  const hmac = new crypto.createHmac("sha512", secret_buffer);
  const hash_digest = hash.update(request["nonce"] + message).digest("binary");
  const hmac_digest = hmac
    .update(path + hash_digest, "binary")
    .digest("base64");

  return hmac_digest;
};

const getTicker = "/0/public/Ticker";
const getTradableUri = "/0/public/AssetPairs";

const getBalanceUri = "/0/private/Balance";
const addOrderUri = "/0/private/AddOrder";

const fetchAuthenticated = async (uriPath, data) => {
  const res = await fetch(`${apiUrl}${uriPath}`, {
    headers: {
      "API-Key": apiKey,
      "API-Sign": getMessageSignature(uriPath, data, apiSecret),
      "Content-Type": "application/x-www-form-urlencoded; charset=utf-8",
    },
    method: "POST",
    body: new URLSearchParams(data),
  });
  return res.json();
};
const fetchPublic = async (uriPath, search) => {
  const res = await fetch(
    `${apiUrl}${uriPath}${search ? `?${search.toString()}` : ""}`
  );

  return res.json();
};

const getBalance = async () => {
  return fetchAuthenticated(getBalanceUri, { nonce: Date.now().toString() });
};
const getAssetPairs = () => {
  return fetchPublic(getTradableUri);
};
const addOrder = async (pairAltName) => {
  const pair = await fetchPublic(
    getTradableUri,
    new URLSearchParams({ pair: pairAltName })
  );
  const orderMin = Number(Object.values(pair.result)[0].ordermin);
  const ticker = await fetchPublic(
    getTicker,
    new URLSearchParams({ pair: pairAltName })
  );
  const recent = Object.values(ticker.result)[0].c[0];

  const addOrderRes = await fetchAuthenticated(addOrderUri, {
    nonce: Date.now().toString(),
    ordertype: "market",
    type: "buy",
    pair: pairAltName,
    volume: Math.max(1 / recent, orderMin).toString(),
    // validate: true,
  });

  console.log(addOrderRes);

  if (addOrderRes.error?.[0] === "EOrder:Insufficient funds") {
    return false;
  }

  return true;
};
const getRemainingPairs = async () => {
  const balance = await getBalance();
  const res = await getAssetPairs();

  return Object.fromEntries(
    Object.entries(res.result).filter(([pair, value]) => {
      if (Number(balance?.result?.[value.base] ?? 0) > 0) {
        return false;
      }

      return value.quote === "ZUSD";
    })
  );
};

let hasMoreFunds = true;
let count = 30;
// while (hasMoreFunds && count) {
//   const pairs = await getRemainingPairs();

//   if (Object.values(pairs).length <= 0) {
//     break;
//   }

//   const pair =
//     Object.values(pairs)[
//       Math.floor(Math.random() * Object.values(pairs).length)
//     ];

//   hasMoreFunds = await addOrder(pair.altname);
//   count--;
// }

const pairs = await getRemainingPairs();
console.log(pairs);
