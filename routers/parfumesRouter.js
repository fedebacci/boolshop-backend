const express = require("express");
const parfumesRouter = express.Router();
const parfumesController = require("../controllers/parfumesController.js");

// # Rotte già gestite
// INDEX
parfumesRouter.get("/", parfumesController.index);
parfumesRouter.get("/bestsellers", parfumesController.indexBestSellers);
parfumesRouter.get("/recents", parfumesController.indexRecents);

// SHOW
parfumesRouter.get("/:id", parfumesController.show);

module.exports = parfumesRouter;
