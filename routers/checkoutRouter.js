const express = require("express");
const checkoutRouter = express.Router();
const checkoutController = require("../controllers/checkoutController.js");

checkoutRouter.post("/", checkoutController.storeCheckout);

module.exports = checkoutRouter;
