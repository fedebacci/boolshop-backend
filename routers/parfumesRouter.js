const express = require('express');
const parfumesRouter = express.Router();
const parfumesController = require('../controllers/parfumesController.js');

const upload = require('../middlewares/multer.js');



// # Rotte già gestite
parfumesRouter.get('/', parfumesController.index);
parfumesRouter.get('/:id', parfumesController.show);




module.exports = parfumesRouter;