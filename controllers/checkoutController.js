// const cart = require("../db/cart")
const connection = require("../db/connection");

cart = {
  id: 1,
  products: [
    {
      id: 1,
      name: "Sauvage",
      image_url: "",
      // ?
      gender_client: "male",
      price: "90.00",
      size_ml: 75,
      // ?
      size_name: "xs",
      brand_name: "Dior",
      discount_amount: 10,
      quantity: 2,
    },
    {
      id: 2,
      name: "Miss Dior",
      image_url: "",
      // ?
      gender_client: "female",
      price: "100.00",
      size_ml: 75,
      // ?
      size_name: "xs",
      brand_name: "Dior",
      discount_amount: 20,
      quantity: 1,
    },
  ],
};

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

  // 1. PRENDI E CONTROLLA CODICE SCONTO DAL DATABASE
  const discountSql =
    "SELECT discount_codes.* FROM discount_codes WHERE code = ?";
  connection.query(discountSql, [user_discount_code], (err, discountResult) => {
    if (err) return res.status(500).json({ error: err });

    // SE CODICE INESISTENTE, CODICE SCONTO = 0
    const discountAmount =
      discountResult.length > 0 ? discountResult[0].amount : 0;
    const discountCodeId =
      discountResult.length > 0 ? discountResult[0].id : null;

    // CALCOLO E PREPARAZIONE DEI DATI PER L'ORDINE
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

    const total_price = checkoutCart.cartProducts.reduce((acc, p) => {
      return acc + p.productFinalPrice * p.quantity;
    }, 0);

    const final_price = total_price - (total_price * discountAmount) / 100;

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
          const orderProductsValues = cart.products.map((p) => [
            orderId,
            p.id,
            p.quantity,
          ]);
          connection.query(orderProductsSql, [orderProductsValues], (err) => {
            if (err) return res.status(500).json({ error: err });

            // RISPOSTA FINALE (DA CAMBIARE SICURAMENTE, AGGIUNTA STRIPE PAYMENT)
            res.json({
              message: "Ordine completato!",
              orderId,
              clientId,
              total_price,
              discountAmount,
              final_price,
              shipment_price,
            });
          });
        }
      );
    });
  });
};

module.exports = {
  storeCheckout,
};
