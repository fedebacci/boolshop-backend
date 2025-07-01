const notFound = (req, res, next) => {
    // console.debug("ERR 404", err);
    console.log("MIDDLEWARE ERR 404");
    console.log(req.path);

    const error = new Error(`Pagina: ${req.path} non trovata`);
    error.statusCode = 404;
    throw error;
};

module.exports = { notFound };