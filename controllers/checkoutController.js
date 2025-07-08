// const cart = require("../db/cart")
const express = require("express");
const connection = require("../db/connection");
const nodemailer = require("nodemailer");
require("dotenv").config();

const now = new Date();

// function getNowInISO() {
//   const now = new Date();
//   return now.toISOString();
// }

const HOST_MAIL = process.env.EMAIL_HOST;
const APP_PW_HOST = process.env.APP_PW_HOST;

const storeCheckout = (req, res) => {
  const {
    email,
    first_name,
    last_name,
    country,
    city,
    postal_code,
    street,
    civic_number,
    user_discount_code,
  } = req.body;

  const clientInfosValues = [
    email,
    first_name,
    last_name,
    country,
    city,
    postal_code,
    street,
    civic_number,
  ];

  // CAMBIA IN BASE A PAGINA DEL CART, PROBABILMENTE SARÁ const cart = req.body.cart;
  // const cart = carts.find((c) => c.id === req.body.cart_id);
  const cart = req.body.cart;

  // 1. PRENDI E CONTROLLA CODICE SCONTO DAL DATABASE CON DATE
  const discountSql =
    "SELECT discount_codes.* FROM discount_codes WHERE code = ?";
  connection.query(discountSql, [user_discount_code], (err, discountResult) => {
    if (err) return res.status(500).json({ error: err });

    // SE CODICE INESISTENTE, CODICE SCONTO = 0
    const discountAmount =
      discountResult.length > 0 ? discountResult[0].amount : 0;
    const discountCodeId =
      discountResult.length > 0 ? discountResult[0].id : null;
    const discountStart =
      discountResult.length > 0 ? new Date(discountResult[0].start_date) : null;
    const discountEnd =
      discountResult.length > 0 ? new Date(discountResult[0].end_date) : null;

    // DA CONTROLLARE COME MAI NON FUNZIONA CON DATE, PROBABILMENTE È UN PROBLEMA DI COMPARAZIONE STRINGHE

    console.log("Data odierna:", now);
    console.log("Data inizio sconto:", discountStart);
    console.log("Data fine sconto:", discountEnd);
    console.log("now < discountStart", now < discountStart);
    console.log("now > discountEnd", now > discountEnd);
    console.log("user_discount_code", user_discount_code);
    console.log("user_discount_code !== ''", user_discount_code !== '');

    if (user_discount_code !== "") {
      if (!discountStart || !discountEnd) {
        return res.status(400).json({ error: "Codice sconto non valido" });
      }
  
      if (now < discountStart || now > discountEnd) {
        return res
          .status(400)
          .json({ error: "Codice sconto non valido o scaduto" });
      }
    }

    // CALCOLO E PREPARAZIONE DEI DATI PER L'ORDINE

    // ROBA CARRELLO

    const checkoutCart = {
      cartProducts: cart.map((product) => {
        return {
          productId: product.id,
          productName: product.name,
          productBrandName: product.brand.brand_name,
          productFinalPrice: parseFloat(
            product.price -
              (product.price * product.discount.discount_amount) / 100
          ).toFixed(2),
          productSize: product.size_ml,
          productBrand: product.brand.brand_name,
          quantity: product.quantity,
        };
      }),
    };
    console.log(checkoutCart);

    const total_price = parseFloat(
      checkoutCart.cartProducts
        .reduce((acc, p) => {
          return acc + p.productFinalPrice * p.quantity;
        }, 0)
        .toFixed(2)
    );

    //  CALCOLO SPEDIZIONE
    const setShipmentPrice = (country, total_price) => {
      let shipment_price;
      if (total_price > 100.0) {
        shipment_price = 0;
      } else if (country === "italy") {
        shipment_price = 2.99;
      } else if (country === "france") {
        shipment_price = 5.99;
      } else if (country === "spain") {
        shipment_price = 8.99;
      } else {
        shipment_price = 13.99;
      }
      return shipment_price;
    };

    const shipment_price = setShipmentPrice(country, total_price);

    const final_price = parseFloat(
      (
        total_price -
        (total_price * discountAmount) / 100 +
        shipment_price
      ).toFixed(2)
    );

    //    INSERT DEI DATI DEL CLIENTE NEL DB
    const clientSql = `
      INSERT INTO client_infos (client_email, client_firstname, client_lastname, client_country, client_city, client_postal_code, client_street, client_civic_number)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    connection.query(clientSql, clientInfosValues, (err, clientResult) => {
      if (err) return res.status(500).json({ error: err });
      const clientId = clientResult.insertId;

      //    INSERT DEI DATI DELL'ORDINE NEL DB

      const orderSql = `
        INSERT INTO orders (client_id, total_price, shipment_price, discount_code_id)
        VALUES (?, ?, ?, ?)
        `;
      connection.query(
        orderSql,
        [clientId, total_price, shipment_price, discountCodeId],
        (err, orderResult) => {
          if (err) return res.status(500).json({ error: err });
          const orderId = orderResult.insertId;

          //  INSERT NELLA TABELLA PIVOT products_orders
          const orderProductsSql = `
            INSERT INTO products_orders (orders_id, products_id, quantity)
            VALUES ?
          `;
          const orderProductsValues = cart.map((p) => [
            orderId,
            p.id,
            p.quantity,
          ]);

          // CREARE PAYMENTINTENT CON STRIPE QUI ???

          connection.query(orderProductsSql, [orderProductsValues], (err) => {
            if (err) return res.status(500).json({ error: err });

            // CREARE PAYMENTINTENT CON STRIPE OPPURE QUI, ANCORA NON SO BENE ???
            const orderRecap = {
              message: "Ordine completato!",
              orderId,
              clientId,
              total_price,
              discountAmount,
              final_price,
              shipment_price,
              checkoutCart,
            };
            // RISPOSTA FINALE (DA CAMBIARE SICURAMENTE, AGGIUNTA STRIPE PAYMENT)

            const transporter = nodemailer.createTransport({
              host: "smtp.gmail.com",
              port: 587, // 465 per SSL
              secure: false, // true per 465, false per altri
              auth: {
                user: HOST_MAIL,
                pass: APP_PW_HOST,
              },
            });
            console.log(clientInfosValues);

            const mailOptions = {
              from: HOST_MAIL,
              to: clientInfosValues[0],
              subject: "Conferma Ordine Boolshop",
              text: `Stato ordine: ${orderRecap.message}
              ID Ordine: ${orderRecap.orderId}
              Prezzo Totale: €${orderRecap.total_price}
              Prezzo Spedizione: €${orderRecap.shipment_price}
              Codice Sconto: ${
                user_discount_code ? user_discount_code : "Nessuno"
              }
              Sconto Applicato: ${orderRecap.discountAmount}%
              Prezzo Finale: €${orderRecap.final_price}
              Dettagli Carrello:
              ${orderRecap.checkoutCart.cartProducts.map((product) => {
                return `
                  Nome: ${product.productName}
                  Brand: ${product.productBrandName}
                  Quantità: ${product.quantity}
                `;
              })}`,
            };

            transporter.sendMail(mailOptions, (error, info) => {
              if (error) {
                console.error("Errore nell'invio dell'email:", error);
              } else {
                console.log("Email inviata:", info.response);
              }
            });
            res.json({
              orderRecap,
              // RITORNARE client_secret AL FRONTEND PER STRIPE
            });
          });
        }
      );
    });
  });
};

// FARE UNA GET PER I DISCOUNT CODES, COSI DA POTERLI MOSTRARE NEL FRONTEND, VEDIAMO INSIEME SE RIUSCIAMO, ALTRIMENTI TUTTA LA VALIDAZIONE BACK C'É

module.exports = {
  storeCheckout,
};
