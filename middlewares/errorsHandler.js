const errorsHandler = (err, req, res, next) => {
    const statusCode = err.statusCode ?? 500;
    const errMessage = err.message ?? "Server error";

    const responseObject = {
        message: errMessage
    };

    if (err.data) {
        responseObject.data = err.data;
    };
    
    // console.debug("ERROR HANDLER PARTITO");
    console.debug("ERROR HANDLER PARTITO: ", err);
    // console.debug("ERROR HANDLER PARTITO: ", responseObject);

    res
        .status(statusCode)
        .json(responseObject);
};


module.exports = { errorsHandler };