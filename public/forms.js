const form = document.querySelector("[data-mock-form]");

if (form) {
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const status = form.querySelector(".form-status");
    status.textContent = "Thanks. This mock submission was validated locally and was not sent to a production provider.";
    form.reset();
  });
}
