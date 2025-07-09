const connection = require("../db/connection");
const Stripe = require("stripe");
const stripe = Stripe(process.env.STRIPE_SECRET_KEY); // METTERE LA TUA CHIAVE SEGRETA DI STRIPE QUI

const storeCheckoutTest = async (req, res) => {
  const now = new Date();
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
    cart,
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
  const discountSql =
    "SELECT discount_codes.* FROM discount_codes WHERE code = ?";

  console.log(req.body.cart);
  try {
    const discountResult = await new Promise((resolve, reject) => {
      connection.query(discountSql, [user_discount_code], (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });

    const discountAmount =
      discountResult.length > 0 ? parseInt(discountResult[0].amount) : 0;
    const discountCodeId =
      discountResult.length > 0 ? discountResult[0].id : null;
    const discountStart =
      discountResult.length > 0 ? new Date(discountResult[0].start_date) : null;
    const discountEnd =
      discountResult.length > 0 ? new Date(discountResult[0].end_date) : null;

    console.log("Data odierna:", now);
    console.log("Data inizio sconto:", discountStart);
    console.log("Data fine sconto:", discountEnd);
    console.log("now < discountStart", now < discountStart);
    console.log("now > discountEnd", now > discountEnd);
    console.log("user_discount_code", user_discount_code);
    console.log("user_discount_code !== ''", user_discount_code !== "");
    console.log("discountResult", discountResult);

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


    console.log("cart", cart);

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
    
    console.log("checkoutCart", checkoutCart);

    const total_price = parseFloat(
      checkoutCart.cartProducts
        .reduce((acc, p) => {
          return acc + p.productFinalPrice * p.quantity;
        }, 0)
        .toFixed(2)
    );
    console.log("total_price", total_price);

    const final_price = total_price - (total_price * discountAmount) / 100;
    console.log("final_price", final_price);

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
    console.log("shipping_price", shipping_price);

    // CREA LA PAYMENT INTENT STRIPE

    // RIDUCIAMO I CARATTERI DEL METADATA
    // I METADATA NON POSSONO SUPERARE I 500 CARATTERI,
    const productsString = JSON.stringify(
      checkoutCart.cartProducts.map((p) => ({
        // PRODUCT ID
        I: p.productId,
        // PRODUCT QUANTITY
        Q: p.quantity,
      }))
    );
    console.log("productsString", productsString);
    
    const amountToPay = Math.round((final_price + shipping_price) * 100);
    console.log("amountToPay", amountToPay);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountToPay,
      payment_method_types: ["card"], // SISTEMARE QUI I VARI METODI DI PAGAMENTO
      currency: "eur",
      metadata: {
        // DATI DA INSERIRE NEL DB TRAMITE IL WEBHOOK DI STRIPE
        // DATI CLIENTE
        email,
        first_name,
        last_name,
        country,
        city,
        postal_code,
        street,
        civic_number,
        // DATI ORDINE
        // client_id LO PRENDIAMO DALL'insertId POI NEL WEBHOOK, DOPO AVER INSERITO I DATI DEL CLIENTE (RIFERIMENTO A CHECKOUT CONTROLLER OG)
        total_price: total_price.toFixed(2),
        shipping_price: shipping_price.toFixed(2),
        discount_code_id: discountCodeId,
        discount_amount: discountAmount,
        // DATI TABELLA PRODUCTS_ORDERS
        products: productsString,
      },
    });

    console.log("paymentIntent", paymentIntent);

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
      discountAmount: discountAmount,
      products: productsString,
    };
    console.log("orderRecap", orderRecap);

    res.json({
      orderRecap,
      checkoutCart,
      clientSecret: paymentIntent.client_secret,
    });
  } catch (err) {
    console.error("Error processing checkout:", err);
    res.status(500).json({ error: err });
    // throw new Error("Error processing checkout");
  }
};

module.exports = {
  storeCheckoutTest,
};
