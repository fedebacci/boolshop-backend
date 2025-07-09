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

    // Gestisci solo il pagamento riuscito
    if (event.type === "payment_intent.succeeded") {
      const paymentIntent = event.data.object;
      const metadata = paymentIntent.metadata;

      // OLTRE 500 CARATTERI metadata VA IN ERRORE, PENSARE A UNA SOLUZIONE VALIDA
      let checkoutCart = [];
      try {
        checkoutCart = JSON.parse(metadata.products);
      } catch (e) {
        console.error("Errore parsing products metadata:", e);
        // Puoi anche rispondere con errore qui
      }
      console.log(
        "------------------------------------------------------------------"
      );
      console.log("Checkout Cart:", checkoutCart);

      // Esempio: salva l'ordine nel database
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

      //   DA RIVEDERE PER BENE

      connection.query(clientSql, clientValues, (err, clientResult) => {
        if (err) {
          console.error("Errore salvataggio ordine:", err);
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

        connection.query(orderSql, orderValues, (err, orderResult) => {
          if (err) return res.status(500).json({ error: err });
          const orderId = orderResult.insertId;
          const orderProductsSql = `
            INSERT INTO products_orders (orders_id, products_id, quantity)
            VALUES ?
          `;
          const orderProductsValues = checkoutCart.map((p) => [
            orderId,
            p.productId,
            p.productQuantity,
          ]);

          connection.query(orderProductsSql, [orderProductsValues], (err) => {
            if (err) return res.status(500).json({ error: err });
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
                     <p>Totale: <strong>${metadata.total_price}€</strong></p>
                     <p>Spedizione: <strong>${
                       metadata.shipping_price
                     }€</strong></p>
                <p>Sconto Applicato: <strong>${
                  metadata.discount_amount != 0
                    ? metadata.discount_amount + "%"
                    : "Nessuno"
                }</strong></p>
                     <ul>
                        ${checkoutCart
                          .map(
                            (product) => `
                          <li>
                            ${product.productName} - 
                            <strong>Quantità: ${product.productQuantity}</strong>
                          </li>`
                          )
                          .join("")}
                     </ul>`,
            };

            transporter.sendMail(mailOptions, (error, info) => {
              if (error) {
                console.error("Errore nell'invio dell'email:", error);
              } else {
                console.log("Email inviata:", info.response);
              }
            });

            res.json({ received: true });
          });
        });
      });
      //   DA RIVEDERE PER BENE

      // AGGIUNTA MAILER QUI
    }
  }
);

module.exports = router;
