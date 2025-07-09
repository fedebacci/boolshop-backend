// # IMPORTS
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const parfumesRouter = require("./routers/parfumesRouter");
const checkoutRouter = require("./routers/checkoutRouter");
const { errorsHandler } = require("./middlewares/errorsHandler");
const { notFound } = require("./middlewares/notFound");
const stripeWebhook = require("./controllers/stripeWebhookControllerTest");

// # CONFIG
const app = express();
const { APP_URL, APP_PORT } = process.env;
const host = APP_PORT ? `${APP_URL}:${APP_PORT}` : APP_URL;

app.use("/webhook/stripe", stripeWebhook);

// # MIDDLEWARES
// - public: serves public files
app.use(express.static("public"));

// - json: parses req bodies
app.use(express.json());

// - cors: allows requests from frontend
const { FRONTEND_APP_URL } = process.env;
const corsConfig = {
  origin: FRONTEND_APP_URL,
};
app.use(cors(corsConfig));

// # ROUTES
app.get("/", (req, res) => {
  // - TEST gestione errori: Internal server error
  // console.log(abc);

  res.json({
    status: "success",
    message: "Index request received",
  });
});

// # ROUTERS
app.use("/parfumes", parfumesRouter);
app.use("/checkout", checkoutRouter);

// # ERROR HANDLING MIDDLEWARES
app.use(notFound);
app.use(errorsHandler);

// # LISTEN
app.listen(APP_PORT, () => {
  console.info(`Server listening on: ${host}`);
});
