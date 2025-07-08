const express = require("express");
const checkoutRouter = express.Router();
const checkoutController = require("../controllers/checkoutController.js");
const checkoutControllerTest = require("../controllers/checkoutControllerTest.js");

checkoutRouter.post("/", checkoutController.storeCheckout);
checkoutRouter.post("/test", checkoutControllerTest.storeCheckoutTest);

module.exports = checkoutRouter;
