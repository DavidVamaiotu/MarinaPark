(() => {
  const pendingDialogs = [];
  let dialogOpen = false;

  function restoreFocus(element) {
    window.setTimeout(() => {
      if (element instanceof HTMLElement && document.contains(element)) {
        element.focus({ preventScroll: true });
      }
    }, 0);
  }

  function runNextDialog() {
    if (dialogOpen || pendingDialogs.length === 0) return;
    dialogOpen = true;

    const request = pendingDialogs.shift();
    const previouslyFocused = document.activeElement;
    const dialog = document.createElement("dialog");
    dialog.className = "app-dialog";
    dialog.setAttribute("aria-labelledby", "app-dialog-title");

    const form = document.createElement("form");
    form.className = "app-dialog-card";
    form.method = "dialog";

    const title = document.createElement("h2");
    title.id = "app-dialog-title";
    title.textContent = request.title;

    const message = document.createElement("p");
    message.textContent = request.message;

    form.append(title, message);

    let input = null;
    if (request.kind === "prompt") {
      input = document.createElement("input");
      input.className = "app-dialog-input";
      input.type = "text";
      input.autocomplete = "off";
      input.value = request.defaultValue;
      input.setAttribute("aria-label", request.inputLabel);
      form.append(input);
    }

    const actions = document.createElement("div");
    actions.className = "app-dialog-actions";

    let cancelButton = null;
    if (request.kind !== "alert") {
      cancelButton = document.createElement("button");
      cancelButton.type = "button";
      cancelButton.className = "app-dialog-cancel";
      cancelButton.textContent = request.cancelLabel;
      actions.append(cancelButton);
    }

    const confirmButton = document.createElement("button");
    confirmButton.type = "submit";
    confirmButton.className = request.danger ? "app-dialog-confirm is-danger" : "app-dialog-confirm";
    confirmButton.textContent = request.confirmLabel;
    actions.append(confirmButton);
    form.append(actions);
    dialog.append(form);
    document.body.append(dialog);

    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      dialog.close();
      dialog.remove();
      dialogOpen = false;
      request.resolve(value);
      restoreFocus(previouslyFocused);
      window.setTimeout(runNextDialog, 0);
    };

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (request.kind === "prompt") {
        finish(input.value);
      } else if (request.kind === "confirm") {
        finish(true);
      } else {
        finish(undefined);
      }
    });
    cancelButton?.addEventListener("click", () => finish(request.kind === "prompt" ? null : false));
    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      finish(request.kind === "prompt" ? null : request.kind === "confirm" ? false : undefined);
    });
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog && request.kind !== "alert") {
        finish(request.kind === "prompt" ? null : false);
      }
    });

    dialog.showModal();
    window.setTimeout(() => (input || confirmButton).focus(), 0);
  }

  function enqueue(request) {
    return new Promise((resolve) => {
      pendingDialogs.push({ ...request, resolve });
      runNextDialog();
    });
  }

  window.appDialog = Object.freeze({
    confirm(message, options = {}) {
      return enqueue({
        kind: "confirm",
        title: options.title || "Confirmare",
        message: String(message || ""),
        confirmLabel: options.confirmLabel || "Confirmă",
        cancelLabel: options.cancelLabel || "Renunță",
        danger: options.danger === true
      });
    },
    prompt(message, options = {}) {
      return enqueue({
        kind: "prompt",
        title: options.title || "Confirmare",
        message: String(message || ""),
        confirmLabel: options.confirmLabel || "Continuă",
        cancelLabel: options.cancelLabel || "Renunță",
        defaultValue: String(options.defaultValue || ""),
        inputLabel: options.inputLabel || "Text de confirmare",
        danger: options.danger === true
      });
    },
    alert(message, options = {}) {
      return enqueue({
        kind: "alert",
        title: options.title || "Marina Park",
        message: String(message || ""),
        confirmLabel: options.confirmLabel || "Închide",
        danger: options.danger === true
      });
    }
  });
})();
