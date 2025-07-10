const connection = require("../db/connection");

const appCarts = [];

// INDEX
// LOGICA PER LA INDEX DI TUTTI I PRODOTTI, CON ANNESSE INFORMAZIONI SUL NOME DEL BRAND, LOGO DEL BRAND E SCONTO APPLICATO SUL SINGOLO PRODOTTO, SE ESISTENTE
const index = (req, res) => {

  // # FILTRI FUNZIONANTI
  let { product_name, brand_slug, gender, max_price, min_price, order_by, size, discounted } = req.query;
  // // ?  * discount_id (filtro nullo o presente, colonna nulla o presente --> 3 casi: si filtro si col, si filtro no col, no filtro)
  // // * Dovrebbe essere undefined, true o false
  // console.debug("discounted", discounted);
  
  // ? FILTRI DA AGGIUNGERE:
  // ?  * discount_amount ? (Forse dovrei fare seconda richiesta a db? Le prop che mi servirebbero arrivano da prima risposta del db)

    if (brand_slug) {
      const brandIdFromSlugSql = `
        SELECT 
          brands.id AS brand_id
        FROM brands

        WHERE brands.slug = ? 
      `;
      connection.query(brandIdFromSlugSql, [brand_slug], (err, brand_id) => {
        if (err) return res.status(500).json({ error: err });
        if (!brand_id.length)
          return res
            .status(404)
            .json({ pageErrorMessage: `I criteri per la ricerca non hanno fornito nessun risultato.` });

        console.debug("brand_id", brand_id);
        getFilteredProducts(res, product_name, brand_id[0].brand_id, gender, max_price, min_price, order_by, size, discounted);
      });

    } else {
      getFilteredProducts(res, product_name, brand_slug, gender, max_price, min_price, order_by, size, discounted);
    }
};

// INDEX CHE MOSTRA TUTTI I PRODOTTI CONSIDERATI BEST SELLERS

const indexBestSellers = (req, res) => {
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

    WHERE products.best_seller = 1
    ORDER BY products.id ASC
  `;

  connection.query(sql, (err, bestSellerResults) => {
    if (err) return res.status(500).json({ error: err });

    res.json(formatIndexResults(bestSellerResults));
  });
};

// INDEX CHE ORDINA I PRODOTTI PER DATA DI USCITA(created_at). MOSTRARE SOLO 10 RISULTATI, ULTIMI 10 PRODOTTI ARRIVATI

const indexRecents = (req, res) => {
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

    ORDER BY products.created_at DESC
    LIMIT 10
  `;

  connection.query(sql, (err, recentsResults) => {
    if (err) return res.status(500).json({ error: err });

    res.json(formatIndexResults(recentsResults));
  });
};

// NOTE PER SUCCESSIVE REST API, SOPRATUTTO LA SHOW, TUTTO QUESTO NON SERVIRÁ, CON UNA INNER JOIN SI PUÓ RISALIRE ALLE INFO CORRELATE AL PRODOTTO,
//  AVREMO ALTRI PARAMETRI A CUI APPOGGIARCI PER FARLO, NON SARÁ(CREDO) NECESSARIA TUTTA QUESTA LOGICA (CHE SICURAMENTE É OTTIMIZZABILE)

const showParfume = (req, res) => {
  // const slug = req.params.slug;
  // const slug = req.params.id;
  
  console.debug("req.params", req.params);
  // console.debug(slug);
  const slug = req.params.slug;


  const productSql = `
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
    
    WHERE products.slug = ?
  `;

  const ingredientsSql = `
    SELECT ingredients.*, 
    ingredients_products.percentage AS percentage
    FROM ingredients

    INNER JOIN ingredients_products 
    ON ingredients_products.ingredient_id = ingredients.id

    WHERE ingredients_products.product_id = ?
  `;

  connection.query(productSql, [slug], (err, productResult) => {
    if (err) return res.status(500).json({ error: err });
    if (productResult.length === 0)
      return res.status(404).json({ error: "Product not found" });
    const product = formatIndexResults(productResult);
    connection.query(ingredientsSql, [product.id], (err, ingredientsResult) => {
      if (err) return res.status(500).json({ error: err });
      if (productResult.length === 0)
        return res
          .status(404)
          .json({ error: `Ingredients not found for product: ${id}.` });
      product.ingredients = ingredientsResult.map((i) => {
        return {
          name: i.name,
          percentage: i.percentage,
        };
      });
      res.json(product);
    });
  });
};

// const cartShow = (req, res) => {
//   let { cart_id } = req.body;

//   let client_cart = appCarts.find((cart) => cart.id === cart_id);
//   console.log("client_cart", client_cart);

//   // * DEBUG
//   // client_cart = appCarts[0];

//   if (!client_cart) {
//     return res.status(404).json({
//       description: `Carello non trovato`,
//     });
//   }

//   res.json({
//     description: `cartShow (${cart_id})`,
//     client_cart,
//   });
// };

// const cartAdd = (req, res) => {
//   let { cart_id, product_id } = req.body;
//   // console.log(appCarts);
//   // console.log("cart_id", cart_id);
//   // console.log("typeof(cart_id)", typeof(cart_id));
//   console.log("product_id", product_id);
//   console.log("typeof(product_id)", typeof product_id);

//   if (!cart_id) {
//     const newCartId = generateNewIndex();
//     console.log("newCartId", newCartId);

//     // # ATTENZIONE
//     // todo:
//     // - Quanto commentato sotto andrebbe (senza priorita) implementato per poter cancellare la riga, sopra, in cui creo forzatamente un array di appCarts vuoto. In questo modo lo creerei dinamicamente
//     // if (!appCarts) {
//     // // if (appCarts === undefined) {
//     //   appCarts = [];
//     // }
//     // console.log("appCarts", appCarts);

//     const newCart = {
//       id: newCartId,
//       products: [],
//     };
//     appCarts.push(newCart);

//     // return res
//     //   .json({
//     //       description: `Devo creare il carrello`,
//     //       newCartId
//     //   });
//     cart_id = newCartId;
//   }

//   const client_cart = appCarts.find((cart) => cart.id === cart_id);
//   console.log("client_cart", client_cart);

//   if (!client_cart) {
//     return res.status(404).json({
//       description: `Carello non trovato`,
//     });
//   }

//   const isProductInCart =
//     client_cart.products.find((product) => product.id === product_id) ===
//     undefined
//       ? false
//       : true;
//   console.log("isProductInCart", isProductInCart);

//   if (isProductInCart) {
//     const product = client_cart.products.find(
//       (product) => product.id === product_id
//     );
//     console.log("product", product);
//     product.quantity += 1;
//     res.json({
//       description: `cartAdd (${cart_id} - product_id: ${product_id})`,
//       client_cart,
//     });
//   } else {
//     const productSql = `
//       SELECT 
//         products.*,
//         brands.name AS brand_name, 
//         brands.logo AS brand_logo,
//         discounts.amount AS discount_amount

//       FROM products

//       INNER JOIN brands 
//       ON products.brand_id = brands.id

//       LEFT JOIN discounts 
//       ON discounts.id = products.discount_id

//       WHERE products.id = ?

//       ORDER BY products.id ASC
//     `;

//     const ingredientsSql = `
//       SELECT ingredients.*, 
//       ingredients_products.percentage AS percentage
//       FROM ingredients

//       INNER JOIN ingredients_products 
//       ON ingredients_products.ingredient_id = ingredients.id

//       WHERE ingredients_products.product_id = ?
//     `;

//     connection.query(productSql, [product_id], (err, productResult) => {
//       if (err) return res.status(500).json({ error: err });
//       if (productResult.length === 0)
//         return res
//           .status(404)
//           .json({ error: `Product ${product_id} not found` });
//       const product = productResult[0];
//       connection.query(
//         ingredientsSql,
//         [product_id],
//         (err, ingredientsResult) => {
//           if (err) return res.status(500).json({ error: err });
//           if (productResult.length === 0)
//             return res.status(404).json({
//               error: `Ingredients not found for product: ${product_id}.`,
//             });
//           product.ingredients = ingredientsResult.map((ingredient) => {
//             return {
//               name: ingredient.name,
//               percentage: ingredient.percentage,
//             };
//           });

//           product.quantity = 1; // Aggiungo la proprietà quantity al prodotto
//           client_cart.products.push(product);
//           res.json({
//             description: `cartAdd (${cart_id} - product_id: ${product_id})`,
//             client_cart,
//           });
//         }
//       );
//     });
//   }
// };

// const cartRemove = (req, res) => {
//   const { cart_id, product_id } = req.body;

//   const client_cart = appCarts.find((cart) => cart.id === cart_id);

//   if (!client_cart) {
//     return res.status(404).json({
//       description: `Carello non trovato`,
//     });
//   }

//   // const isProductInCart = client_cart.products.find(product => product.id === product_id) === undefined ? false : true;
//   const isProductInCart = client_cart.products.find(
//     (product) => product.id === product_id
//   );

//   if (isProductInCart) {
//     client_cart.products.splice(
//       client_cart.products.indexOf(isProductInCart),
//       1
//     );
//   } else {
//     return res.status(404).json({
//       description: `Prodotto ${product_id} non trovato nel carrello: ${cart_id}. Impossibile cancellare il prodotto`,
//     });
//   }

//   res.json({
//     description: `cartRemove (${cart_id} - product_id: ${product_id})`,
//     client_cart,
//   });
// };

const generateNewIndex = () => {
  const options = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let randomString = "";
  while (randomString.length < 5) {
    const randomIndex = Math.floor(Math.random() * options.length);
    randomString += options[randomIndex];
  }

  const cartAlreadyExists = appCarts.find((cart) => cart.id === newCartId);
  console.log("cartAlreadyExists", cartAlreadyExists);

  if (cartAlreadyExists) {
    return generateNewIndex();
  }

  return randomString;
};

// *
const { APP_URL, APP_PORT } = process.env;
const host = APP_PORT ? `${APP_URL}:${APP_PORT}` : APP_URL;
const formatImage = (image) => {
  // console.debug(image);
  // * Definitivo da utilizzare in seguito
  return image ? `${host}/images/parfumes/${image}` : `${host}/images/parfumes/placeholder.jpg`;
  // return image ? `${host}/images/parfumes/Immagini Fede/${image}` : `${host}/images/parfumes/placeholder.jpg`;
};

function formatIndexResults(r) {
  const formattedResults = r.map((product) => ({
    id: product.id,
    slug: product.slug,
    name: product.name,
    // image: product.image_url,
    image: formatImage(product.image_url),
    gender: product.gender_client,
    description: product.description,
    best_seller: product.best_seller,
    entry_date: product.created_at,
    price: product.price,
    size_ml: product.size_ml,
    size_name: product.size_name,
    brand: {
      brand_id: product.brand_id,
      brand_name: product.brand_name,
      brand_logo: product.brand_logo,
    },
    discount: {
      discount_id: product.discount_id,
      discount_amount: product.discount_amount ? product.discount_amount : 0,
    },
  }));
  return formattedResults;
}



const getFilteredProducts = (res, product_name, brand_id, gender, max_price, min_price, order_by, size, discounted) => {
  // ?  * discount_id (filtro nullo o presente, colonna nulla o presente --> 3 casi: si filtro si col, si filtro no col, no filtro)
  // * Dovrebbe essere undefined, true o false
  // console.debug("discounted", discounted);



  // # TEST VALIDAZIONE
  // Validazione del filtro per price
  // *min_price
  if (min_price && isNaN(min_price)) {
    return res.status(500).json(
      { error: "Il prezzo minimo deve essere un numero." }
    );
  }
  if (min_price && Number(min_price) < 0) {
    return res.status(500).json(
      { error: "Il prezzo minimo non può essere minore di 0." }
    );
  }
  if (min_price && Number(min_price) > 1000) {
    return res.status(500).json(
      { error: "Il prezzo minimo non può essere maggiore di 1000." }
    );
  }

  // *max_price
  if (max_price && isNaN(max_price)) {
    return res.status(500).json(
      { error: "Il prezzo massimo deve essere un numero." }
    );
  }
  if (max_price && Number(max_price) < 0) {
    return res.status(500).json(
      { error: "Il prezzo massimo non può essere minore di 0." }
    );
  }
  if (max_price && Number(max_price) > 1000) {
    return res.status(500).json(
      { error: "Il prezzo massimo non può essere maggiore di 1000." }
    );
  }

  // *max_price E min_price
  if (
    min_price &&
    max_price &&
    parseFloat(min_price) > parseFloat(max_price)
  ) {
    return res.status(500).json(
      { error: "Il prezzo minimo non può essere maggiore del prezzo massimo." }
    );
  }

  // Validazione del filtro nome del prodotto
  if (product_name && product_name.length > 50) {
    return res.status(500).json(
      { error: "Il nome del prodotto non può essere più lungo di 50 caratteri." }
    );
  }

  // Validazione del filtro brand
  // todo: decidere se mantenere controllo su brand_slug, spostare controllo su brand_id o eliminare
  // if (
  //   tempBrandSlug &&
  //   ![
  //     "dior",
  //     "chanel",
  //     "calvin_klein",
  //     "giorgio_armani",
  //     "maison_lumière",
  //     "nordica_scents",
  //   ].includes(tempBrandSlug)
  // ) {
  //   alert(
  //     "Marca non valida. Scegli tra una di queste: Dior, Chanel, Calvin Klein, Giorgio Armani, Maison Lumière, Nordica Scents."
  //   );
  //   return;
  // }

  // Validazione del filtro size
  if (size && !["xs", "s", "m", "l", "xl", "xxl"].includes(size)) {
    return res.status(500).json(
      { error: "Formato non valido. Scegli tra xs, s, m, l, xl, xxl." }
    );
  }

  // Validazione del filtro genere
  if (gender && !["male", "female", "unisex"].includes(gender)) {
    return res.status(500).json(
      { error: "Genere non valido. Scegli tra Uomo, Donna o Unisex." }
    );
  }

  // validazione del filtro per ordinamento
  const validOrderBy = [
    "",
    "products.price ASC",
    "products.price DESC",
    "products.name ASC",
    "products.name DESC",
    "products.size_ml ASC",
    "products.size_ml DESC",
  ];
  if (order_by && !validOrderBy.includes(order_by)) {
    return res.status(500).json(
      { error: "Ordinamento non valido." }
    );
  }






  const sqlFilters = [];
  let sql = `
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
  `;

  if (product_name) {
    sqlFilters.length === 0
      ? (sql += `
        WHERE products.name LIKE ?
      `)
      : (sql += `
        AND products.name LIKE ?
      `);
    sqlFilters.push(`%${product_name}%`);
  }
  if (brand_id) {
    sqlFilters.length === 0
      ? (sql += `
        WHERE products.brand_id = ?
      `)
      : (sql += `
        AND products.brand_id = ?
      `);
    sqlFilters.push(brand_id);
  }
  if (gender) {
    sqlFilters.length === 0
      ? (sql += `
        WHERE products.gender_client = ?
      `)
      : (sql += `
        AND products.gender_client = ?
      `);
    sqlFilters.push(gender);
  }
  if (max_price) {
    sqlFilters.length === 0
      ? (sql += `
        WHERE products.price <= ?
      `)
      : (sql += `
        AND products.price <= ?
      `);
    sqlFilters.push(max_price);
  }
  if (min_price) {
    sqlFilters.length === 0
      ? (sql += `
        WHERE products.price >= ?
      `)
      : (sql += `
        AND products.price >= ?
      `);
    sqlFilters.push(min_price);
  }
  if (size) {
    sqlFilters.length === 0
      ? (sql += `
        WHERE products.size_name = ?
      `)
      : (sql += `
        AND products.size_name = ?
      `);
    sqlFilters.push(size);
  }
  if (size) {
    sqlFilters.length === 0
      ? (sql += `
        WHERE products.size_name = ?
      `)
      : (sql += `
        AND products.size_name = ?
      `);
    sqlFilters.push(size);
  }

  // ISNULL(products.discount_id) = 1
  if (discounted) {
    sqlFilters.length === 0
      ? (sql += `
        WHERE ISNULL(products.discount_id) = ?
      `)
      : (sql += `
        AND ISNULL(products.discount_id) = ?
      `);

    if (discounted === "true") {
      sqlFilters.push(0); // Per ottenere i prodotti con sconto
    } else if (discounted === "false") {
      sqlFilters.push(1); // Per ottenere i prodotti senza sconto
    } else {
      sqlFilters.push(0); // Default, per ottenere tutti i prodotti
    }
  }
  
  if (!order_by) {
    sql += `
    ORDER BY products.id ASC
    `;
  } else {
    sql += `ORDER BY ` + order_by;
  }
  
  connection.query(sql, sqlFilters, (err, results) => {

    
    if (err) return res.status(500).json({ error: err });
    if (!results.length)
      return res
        .status(404)
        .json({ pageErrorMessage: `I criteri per la ricerca non hanno fornito nessun risultato.` });


    // console.log("order_by", order_by);
    // console.log("results", results);
    // if (order_by) {
    //   if (order_by.includes("price")) {
    //     console.debug("Ordinamento per prezzo");
    //   }
    //   if (order_by.includes("ASC")) {
    //     console.debug("Ordinamento in ordine crescente");
    //   }
    //   if (order_by.includes("DESC")) {
    //     console.debug("Ordinamento in ordine decrescente");
    //   }
    // }


    let orderedResults = results;
    if (order_by && order_by.includes("price")) {
      const direction = order_by.includes("ASC") ? "crescente" : "decrescente";
      if (direction === "crescente") {
        orderedResults = results.sort((firstResult, secondResult) => (firstResult.price - (firstResult.price * firstResult.discount_amount) / 100) - (secondResult.price - (secondResult.price * secondResult.discount_amount) / 100));
      } else if (direction === "decrescente") {
        orderedResults = results.sort((firstResult, secondResult) => (secondResult.price - (secondResult.price * secondResult.discount_amount) / 100) - (firstResult.price - (firstResult.price * firstResult.discount_amount) / 100));
      }
    }


    if (max_price) {
      orderedResults = orderedResults.filter(result => result.price - (result.price * result.discount_amount) / 100 <= max_price);
    }
    if (min_price) {
      orderedResults = orderedResults.filter(result => result.price - (result.price * result.discount_amount) / 100 >= min_price);
    }


    res.json(formatIndexResults(orderedResults));
  });
}

module.exports = {
  index,
  indexBestSellers,
  indexRecents,
  showParfume,
};
