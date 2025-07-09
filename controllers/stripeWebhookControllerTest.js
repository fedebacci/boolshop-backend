const express = require("express");
const router = express.Router();
const Stripe = require("stripe");
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const connection = require("../db/connection");

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
      const checkoutCart = JSON.parse(metadata.products);
      console.log(
        "------------------------------------------------------------------"
      );
      console.log("Checkout Cart:", checkoutCart);

      // Esempio: salva l'ordine nel database
      const insertOrderSql = `
        INSERT INTO orders
        (email, first_name, last_name, country, city, postal_code, street, civic_number, total_price, shipping_price, discount_code_id, payment_intent_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      const values = [
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
        metadata.discount_code_id || null,
        metadata.products,
      ];

      //   DA RIVEDERE PER BENE

      connection.query(insertOrderSql, values, (err, result) => {
        if (err) {
          console.error("Errore salvataggio ordine:", err);
        } else {
          console.log("Ordine salvato con successo, ID:", result.insertId);
        }
      });

      // AGGIUNTA MAILER QUI
    }

    res.json({ received: true });
  }
);

module.exports = router;
