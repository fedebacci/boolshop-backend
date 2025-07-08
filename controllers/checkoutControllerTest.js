const connection = require("../db/connection");
const Stripe = require("stripe");
const stripe = Stripe(process.env.STRIPE_SECRET_KEY); // METTERE LA TUA CHIAVE SEGRETA DI STRIPE QUI

const storeCheckoutTest = async (req, res) => {
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

  // PRENDI E CONTROLLA CODICE SCONTO DAL DATABASE
  const discountSql = "SELECT amount FROM discount_codes WHERE code = ?";
  try {
    const discountResult = await new Promise((resolve, reject) => {
      connection.query(discountSql, [user_discount_code], (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });

    const discountAmount =
      discountResult.length > 0 ? discountResult[0].amount : 0;

    const checkoutCart = {
      cartId: cart.id,
      cartProducts: cart.products.map((product) => {
        return {
          productName: product.name,
          productId: product.id,
          productFinalPrice:
            product.price - (product.price * product.discount_amount) / 100,
          productSize: product.size_ml,
          productBrand: product.brand_name,
          quantity: product.quantity,
        };
      }),
    };

    const total_price = checkoutCart.cartProducts.reduce((acc, p) => {
      return acc + p.productFinalPrice * p.quantity;
    }, 0);

    const final_price = total_price - (total_price * discountAmount) / 100;

    const setShippingPrice = (country, total_price) => {
      let shipping_price;
      if (total_price > 100.0) {
        shipping_price = 0;
      } else if (country === "italy") {
        shipping_price = 2.99;
      } else if (country === "france") {
        shipping_price = 5.99;
      } else if (country === "spain") {
        shipping_price = 8.99;
      } else {
        shipping_price = 13.99;
      }
      return shipping_price;
    };

    const shipping_price = setShippingPrice(country, total_price);

    // CREA LA PAYMENT INTENT STRIPE
    const amountToPay = Math.round((final_price + shipping_price) * 100);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountToPay,
      currency: "eur",
      metadata: {
        email: email,
        cartId: cart.id.toString(),
      },
    });

    const orderRecap = {
      email,
      first_name,
      last_name,
      country,
      city,
      postal_code,
      street,
      civic_number,
      total_price: total_price.toFixed(2),
      final_price: final_price.toFixed(2),
      shipping_price: shipping_price.toFixed(2),
      discountAmount: discountAmount.toFixed(2),
    };

    res.json({
      orderRecap,
      checkoutCart,
      clientSecret: paymentIntent.client_secret,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  storeCheckoutTest,
};
