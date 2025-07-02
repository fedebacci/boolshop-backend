const connection = require("../db/connection");
// const cart = require("../db/cart")
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
// INDEX

// LOGICA PER LA INDEX DI TUTTI I PRODOTTI, CON ANNESSE INFORMAZIONI SUL NOME DEL BRAND, LOGO DEL BRAND E SCONTO APPLICATO SUL SINGOLO PRODOTTO, SE ESISTENTE

const index = (req, res) => {
  const sql = `
    SELECT 
      products.*,      
      brands.name AS brand_name, 
      brands.logo AS brand_logo,
      discount_codes.amount AS discount_amount
    FROM products

    INNER JOIN brands 
    ON products.brand_id = brands.id

    LEFT JOIN discount_codes 
    ON discount_codes.id = products.discount_id

    ORDER BY products.id ASC

  `;

  connection.query(sql, (err, results) => {
    if (err) return res.status(500).json({ error: err });

    res.json(results);
  });
};

// INDEX CHE MOSTRA TUTTI I PRODOTTI CONSIDERATI BEST SELLERS

const indexBestSellers = (req, res) => {
  const sql = `
    SELECT 
      products.*,      
      brands.name AS brand_name, 
      brands.logo AS brand_logo,
      discount_codes.amount AS discount_amount
    FROM products

    INNER JOIN brands 
    ON products.brand_id = brands.id

    LEFT JOIN discount_codes 
    ON discount_codes.id = products.discount_id

    WHERE products.best_seller = 1
    ORDER BY products.id ASC
  `;

  connection.query(sql, (err, bestSellerResults) => {
    if (err) return res.status(500).json({ error: err });

    res.json(bestSellerResults);
  });
};

// INDEX CHE ORDINA I PRODOTTI PER DATA DI USCITA(created_at). MOSTRARE SOLO 10 RISULTATI, ULTIMI 10 PRODOTTI ARRIVATI

const indexRecents = (req, res) => {
  const sql = `
    SELECT 
      products.*,      
      brands.name AS brand_name, 
      brands.logo AS brand_logo,
      discount_codes.amount AS discount_amount
    FROM products

    INNER JOIN brands 
    ON products.brand_id = brands.id

    LEFT JOIN discount_codes 
    ON discount_codes.id = products.discount_id

    ORDER BY products.created_at DESC
    LIMIT 10

  `;

  connection.query(sql, (err, results) => {
    if (err) return res.status(500).json({ error: err });

    res.json(results);
  });
};

// NOTE PER SUCCESSIVE REST API, SOPRATUTTO LA SHOW, TUTTO QUESTO NON SERVIRÁ, CON UNA INNER JOIN SI PUÓ RISALIRE ALLE INFO CORRELATE AL PRODOTTO,
//  AVREMO ALTRI PARAMETRI A CUI APPOGGIARCI PER FARLO, NON SARÁ(CREDO) NECESSARIA TUTTA QUESTA LOGICA (CHE SICURAMENTE É OTTIMIZZABILE)

const showParfume = (req, res) => {
  const id = req.params.id;
  const productSql = `
    SELECT 
      products.*,      
      brands.name AS brand_name, 
      brands.logo AS brand_logo,
      discount_codes.amount AS discount_amount

    FROM products

    INNER JOIN brands 
    ON products.brand_id = brands.id

    LEFT JOIN discount_codes 
    ON discount_codes.id = products.discount_id
    
    WHERE products.id = ?
  `;

  const ingredientSql = `
  SELECT ingredients.*, 
  ingredients_products.percentage AS percentage
  FROM ingredients

  INNER JOIN ingredients_products 
  ON ingredients_products.ingredient_id = ingredients.id

  WHERE ingredients_products.product_id = ?
  `;

  connection.query(productSql, [id], (err, productResult) => {
    if (err) return res.status(500).json({ error: err });
    if (productResult.length === 0)
      return res.status(500).json({ error: "Product not found" });
    const product = productResult[0];
    connection.query(ingredientSql, [id], (err, ingredientResult) => {
      if (err) return res.status(500).json({ error: err });
      product.ingredients = ingredientResult.map((i) => {
        return {
          name: i.name,
          percentage: i.percentage,
        };
      });
      res.json(product);
    });
  });
};

//  API DA METTERE NELLA PAGINA DEL FORM

const storeCheckout = (req, res) => {
  // REQUIRE DEL CART
  const {
    email,
    first_name,
    last_name,
    country,
    city,
    postal_code,
    street,
    civic_number,
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

  // PRENDI E CONTROLLA CODICE SCONTO

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
};

// *
const { APP_URL, APP_PORT } = process.env;
const host = APP_PORT ? `${APP_URL}:${APP_PORT}` : APP_URL;
// const formatImage = (image) => {
//     return image ? `${host}/images/parfumes/${image}` : `${host}/images/parfumes/placeholder.jpg`;
// };

module.exports = {
  index,
  indexBestSellers,
  indexRecents,
  showParfume,
  storeCheckout,
};
