const express = require("express");
const router = express.Router();
const Stripe = require("stripe");
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const connection = require("../db/connection");
const nodemailer = require("nodemailer");

const HOST_MAIL = process.env.EMAIL_HOST;
const APP_PW_HOST = process.env.APP_PW_HOST;

// Stripe richiede il body RAW per la verifica della firma!
router.post(
  "/",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const sig = req.headers["stripe-signature"];
    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET // Prendi questa chiave dalla dashboard Stripe
      );
    } catch (err) {
      console.error("Webhook signature verification failed.", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // GESTIONE PAGAMENTO RIUSCITO
    if (event.type === "payment_intent.succeeded") {
      const paymentIntent = event.data.object;
      const metadata = paymentIntent.metadata;

      // OLTRE 500 CARATTERI metadata VA IN ERRORE, PENSARE A UNA SOLUZIONE VALIDA (CIRCA RISOLTO)
      let checkoutCart = [];
      try {
        checkoutCart = JSON.parse(metadata.products);
      } catch (e) {
        console.error("Errore parsing products metadata:", e);
        return res
          .status(400)
          .json({ error: "Errore parsing products metadata" });
      }

      // Controlli aggiuntivi sui dati ricevuti
      const requiredFields = [
        metadata.email,
        metadata.first_name,
        metadata.last_name,
        metadata.country,
        metadata.city,
        metadata.postal_code,
        metadata.street,
        metadata.civic_number,
        metadata.total_price,
        metadata.shipping_price,
        metadata.products,
      ];
      const isEmpty = (val) =>
        val === undefined ||
        val === null ||
        (typeof val === "string" && val.trim() === "");
      if (
        requiredFields.some(isEmpty) ||
        !Array.isArray(checkoutCart) ||
        checkoutCart.length === 0 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(metadata.email) ||
        isNaN(Number(metadata.total_price)) ||
        isNaN(Number(metadata.shipping_price))
      ) {
        return res
          .status(400)
          .json({ error: "Dati obbligatori mancanti o non validi" });
      }

      console.log(
        "------------------------------------------------------------------"
      );
      console.log("Checkout Cart:", checkoutCart);

      const clientSql = `
      INSERT INTO client_infos (client_email, client_firstname, client_lastname, client_country, client_city, client_postal_code, client_street, client_civic_number)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
      const clientValues = [
        metadata.email,
        metadata.first_name,
        metadata.last_name,
        metadata.country,
        metadata.city,
        metadata.postal_code,
        metadata.street,
        metadata.civic_number,
      ];

      connection.query(clientSql, clientValues, (err, clientResult) => {
        if (err) {
          console.error("Errore salvataggio ordine (client_infos):", err);
          return res.status(500).json({ error: err });
        }
        const clientId = clientResult.insertId;

        const orderSql = `
        INSERT INTO orders (client_id, total_price, shipment_price, discount_code_id, payment_status)
        VALUES (?, ?, ?, ?, ?)
        `;
        const orderValues = [
          clientId,
          parseFloat(metadata.total_price),
          parseFloat(metadata.shipping_price),
          metadata.discount_code_id || null,
          paymentIntent.status,
        ];

        // QUERY PER INSERIRE L'ORDINE

        connection.query(orderSql, orderValues, (err, orderResult) => {
          if (err) {
            console.error("Errore salvataggio ordine (orders):", err);
            return res.status(500).json({ error: err });
          }
          const orderId = orderResult.insertId;
          const orderProductsSql = `
            INSERT INTO products_orders (orders_id, products_id, quantity)
            VALUES ?
          `;
          const orderProductsValues = checkoutCart.map((p) => [
            orderId,
            p.I,
            p.Q,
          ]);

          connection.query(orderProductsSql, [orderProductsValues], (err) => {
            if (err) {
              console.error(
                "Errore salvataggio ordine (products_orders):",
                err
              );
              return res.status(500).json({ error: err });
            }
            const productIds = checkoutCart.map((p) => p.I);

            const sql = `
                  SELECT 
                    products.*,      
                    brands.name AS brand_name, 
                    brands.logo AS brand_logo,
                    discounts.amount AS discount_amount

                  FROM products

                  INNER JOIN brands 
                  ON products.brand_id = brands.id

                  LEFT JOIN discounts 
                  ON discounts.id = products.discount_id
                  
                  WHERE products.id IN (?)`;

            connection.query(sql, [productIds], (err, products) => {
              if (err) {
                console.error(
                  "Errore salvataggio ordine (products SELECT):",
                  err
                );
                return res.status(500).json({ error: err });
              }

              // RECAP DELL'ORDINE
              const recap = products.map((prod) => {
                const cartItem = checkoutCart.find((p) => p.I == prod.id);
                return {
                  ...prod,
                  quantity: cartItem ? cartItem.Q : 0,
                };
              });

              console.log("Recap:", recap);

              const transporter = nodemailer.createTransport({
                host: "smtp.gmail.com",
                port: 587, // 465 per SSL
                secure: false, // true per 465, false per altri
                auth: {
                  user: HOST_MAIL,
                  pass: APP_PW_HOST,
                },
              });

              const mailOptions = {
                from: HOST_MAIL,
                to: metadata.email,
                subject: "Conferma Ordine Boolshop Parfumes",
                text: `Grazie per il tuo ordine! ID Ordine: ${orderId}`,
                html: `
              <h2>Grazie per il tuo ordine!</h2>
              <h4> ID Ordine: ${orderId}</h4>
                     <p>Prezzo iniziale: <strong>${
                       metadata.total_price
                     } €</strong></p>
                     <p>Costo spedizione: <strong>${
                       metadata.shipping_price > 0
                         ? metadata.shipping_price + " €"
                         : "Gratuita"
                     }</strong></p>
                     </strong></p>
                <p>Percentuale codice sconto applicato: <strong>${
                  metadata.discount_amount != 0
                    ? metadata.discount_amount + " %"
                    : "Nessuno"
                }</strong></p>
                <p>Prezzo finale pagato: <strong>${
                  metadata.payed
                } €</strong></p>
                     <ul style="list-style:none;padding:0;margin:0;">
                        ${recap
                          .map(
                            (product) => `
                          <li>
                              <strong>Prodotto: </strong>${product.name} - (${
                              product.size_ml
                            }ml) 
                              <br /> 
                              <strong>Brand : </strong>${
                                product.brand_name
                              } <br />
                              <strong>Prezzo Originale: </strong> ${
                                product.price
                              } €<br />
                              ${
                                product.discount_amount > 0
                                  ? "<strong>Prezzo Scontato (" +
                                    product.discount_amount +
                                    " %): </strong>" +
                                    (
                                      parseFloat(product.price) -
                                      (parseFloat(product.price) *
                                        parseFloat(product.discount_amount)) /
                                        100
                                    ).toFixed(2) +
                                    " €<br />"
                                  : ""
                              } 
                              <strong>Quantità: </strong>${product.quantity}
                          </li>
                          <hr />`
                          )
                          .join("")}
                     </ul>`,
              };

              transporter.sendMail(mailOptions, (error, info) => {
                if (error) {
                  console.error("Errore nell'invio dell'email:", error);
                } else {
                  console.log("Email inviata:", info.response);
                  res.json({ received: true });
                }
              });
            });
          });
        });
      });
    } else {
      // RISPONDE A EVENTI NON GESTITI
      return res.status(200).json({ received: true });
    }
  }
);

module.exports = router;
