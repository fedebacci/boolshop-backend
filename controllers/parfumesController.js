const connection = require('../db/connection');



const index = (req, res) => {

};



const show = (req, res) => {

};

















// * 
const { APP_URL, APP_PORT } = process.env;
const host = APP_PORT ? `${APP_URL}:${APP_PORT}` : APP_URL;
const formatImage = (image) => {
    return image ? `${host}/images/parfumes/${image}` : `${host}/images/parfumes/placeholder.jpg`;
};



module.exports = { 
    index,
    show
};