export function createOrder(apiUrl, productId) {
  return fetch(new URL("/orders", apiUrl), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ productId }),
  });
}
