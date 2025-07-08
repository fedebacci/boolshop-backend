// const cart = require("../db/cart")
const connection = require("../db/connection");

// cart = {
//   id: 1,
//   products: [
//     {
//       id: 1,
//       name: "Sauvage",
//       image_url: "",
//       // ?
//       gender_client: "male",
//       price: "90.00",
//       size_ml: 75,
//       // ?
//       size_name: "xs",
//       brand_name: "Dior",
//       discount_amount: 10,
//       quantity: 2,
//     },
//     {
//       id: 2,
//       name: "Miss Dior",
//       image_url: "",
//       // ?
//       gender_client: "female",
//       price: "100.00",
//       size_ml: 75,
//       // ?
//       size_name: "xs",
//       brand_name: "Dior",
//       discount_amount: 20,
//       quantity: 1,
//     },
//   ],
// };

const storeCheckout = (req, res) => {
  // REQUIRE DEL CART (PER ORA HARD-CODATO)

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
  connection.query(discountSql, [user_discount_code], (err, discountResult) => {
    if (err) return res.status(500).json({ error: err });

    // SE CODICE INSESISTENTE, CODICE SCONTO = 0
    const discountAmount =
      discountResult.length > 0 ? discountResult[0].amount : 0;

    const checkoutCart = {
      cartId: cart.id,
      cartProducts: cart.products.map((product) => {
        return {
          productId: product.id,
          productFinalPrice:
            product.price - (product.price * product.discount_amount) / 100,
          productSize: product.size_ml,
          productBrand: product.brand_name,
          quantity: product.quantity,
        };
      }),
    };
    console.log(checkoutCart);
    const total_price = checkoutCart.cartProducts.reduce((acc, p) => {
      return acc + p.productFinalPrice * p.quantity;
    }, 0);
    console.log(total_price);

    // APPLICO SCONTO DEL CODICE SCONTO SU PREZZO TOTALE

    const final_price = total_price - (total_price * discountAmount) / 100;

    // GESTIONE PREZZI DI SPEDIZIONE IN BASE AL PAESE DI DESTINAZIONE O AL PREZZO TOTALE(GRATUITA OLTRE I 100€)

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

    res.json({
      checkoutCart,
      total_price,
      final_price,
      shipping_price,
      discountAmount,
    });
  });
};

module.exports = {
  storeCheckout,
};
