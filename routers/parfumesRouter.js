const express = require("express");
const parfumesRouter = express.Router();
const parfumesController = require("../controllers/parfumesController.js");

// # Rotte già gestite
// INDEX
parfumesRouter.get("/", parfumesController.index);
parfumesRouter.get("/bestsellers", parfumesController.indexBestSellers);
parfumesRouter.get("/recents", parfumesController.indexRecents);


// parfumesRouter.get("/cartShow", parfumesController.cartShow);
// parfumesRouter.post("/cartAdd", parfumesController.cartAdd);
// parfumesRouter.delete("/cartRemove", parfumesController.cartRemove);

// SHOW
parfumesRouter.get("/:slug", parfumesController.showParfume);

module.exports = parfumesRouter;
