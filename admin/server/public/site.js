(function () {
  "use strict";
  var html = document.documentElement;
  html.classList.remove("no-js");
  html.classList.add("js");

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function goal(name) {
    var id = document.body.getAttribute("data-metrika");
    if (id && typeof window.ym === "function") window.ym(Number(id), "reachGoal", name);
  }

  var cookie = $("[data-cookie]");
  var cookieOk = $("[data-cookie-ok]");
  if (cookie && cookieOk) {
    cookieOk.addEventListener("click", function (e) {
      e.preventDefault();
      document.cookie = "cookies_ok=1; path=/; max-age=31536000; samesite=lax";
      cookie.hidden = true;
    });
  }

  $$(".m-menu a").forEach(function (a) {
    a.addEventListener("click", function () {
      var d = a.closest("details");
      if (d) d.open = false;
    });
  });

  $$(".js-autosubmit select").forEach(function (s) {
    s.addEventListener("change", function () { s.form.submit(); });
  });

  $$(".js-program").forEach(function (root) {
    var tabs = $$(".prog-days [role=tab]", root);
    var panels = $$(".day-panel", root);
    var hallBtns = $$(".prog-halls button", root);
    function showDay(id) {
      tabs.forEach(function (t) { t.setAttribute("aria-selected", String(t.getAttribute("data-day") === id)); t.tabIndex = t.getAttribute("data-day") === id ? 0 : -1; });
      panels.forEach(function (p) { p.hidden = p.id !== "day-" + id; });
    }
    tabs.forEach(function (t, i) {
      t.addEventListener("click", function () { showDay(t.getAttribute("data-day")); });
      t.addEventListener("keydown", function (e) {
        if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
        var n = tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
        n.focus();
        showDay(n.getAttribute("data-day"));
      });
    });
    hallBtns.forEach(function (b) {
      b.addEventListener("click", function () {
        var hall = b.getAttribute("data-hall");
        hallBtns.forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
        $$(".slot", root).forEach(function (s) {
          var h = s.getAttribute("data-hall");
          s.hidden = !!hall && !!h && h !== hall;
        });
      });
    });
  });

  $$("[data-countdown]").forEach(function (el) {
    var target = Number(el.getAttribute("data-countdown"));
    var d = $("[data-cd=d]", el), h = $("[data-cd=h]", el), m = $("[data-cd=m]", el), s = $("[data-cd=s]", el);
    function pad(n) { return (n < 10 ? "0" : "") + n; }
    function tick() {
      var diff = Math.max(0, target - Date.now());
      d.textContent = String(Math.floor(diff / 864e5));
      h.textContent = pad(Math.floor((diff % 864e5) / 36e5));
      m.textContent = pad(Math.floor((diff % 36e5) / 6e4));
      s.textContent = pad(Math.floor((diff % 6e4) / 1e3));
    }
    tick();
    setInterval(tick, 1000);
  });

  var anchors = $$(".anchors a");
  if (anchors.length && "IntersectionObserver" in window) {
    var byId = {};
    anchors.forEach(function (a) { byId[a.getAttribute("href").slice(1)] = a; });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        anchors.forEach(function (a) { a.classList.remove("on"); });
        var a = byId[en.target.id];
        if (a) {
          a.classList.add("on");
          a.scrollIntoView({ block: "nearest", inline: "center" });
        }
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    Object.keys(byId).forEach(function (id) { var el = document.getElementById(id); if (el) io.observe(el); });
  }

  function formatPhone(v) {
    var d = v.replace(/\D/g, "");
    if (!d) return "";
    if (d[0] === "8") d = "7" + d.slice(1);
    if (d[0] === "9") d = "7" + d;
    if (d[0] !== "7") return "+" + d.slice(0, 15);
    d = d.slice(1, 11);
    var out = "+7";
    if (d.length) out += " (" + d.slice(0, 3);
    if (d.length >= 3) out += ")";
    if (d.length > 3) out += " " + d.slice(3, 6);
    if (d.length > 6) out += "-" + d.slice(6, 8);
    if (d.length > 8) out += "-" + d.slice(8, 10);
    return out;
  }
  $$("input[type=tel]").forEach(function (i) {
    i.addEventListener("input", function () {
      var atEnd = i.selectionStart === i.value.length;
      var f = formatPhone(i.value);
      if (f !== i.value && atEnd) i.value = f;
    });
  });

  function clearErrors(form) {
    $$(".field.has-error", form).forEach(function (f) { f.classList.remove("has-error"); });
    $$(".ferr", form).forEach(function (e) { e.textContent = ""; });
    $$("[aria-invalid]", form).forEach(function (e) { e.removeAttribute("aria-invalid"); });
    var msg = $(".form-msg", form);
    if (msg) msg.textContent = "";
  }

  function showErrors(form, fields, message) {
    var first = null;
    Object.keys(fields || {}).forEach(function (name) {
      var key = name.split(".")[0];
      var field = $('[data-field="' + key + '"]', form);
      if (!field) return;
      field.classList.add("has-error");
      var err = $(".ferr", field);
      if (err) err.textContent = fields[name];
      var input = $("input,select,textarea", field);
      if (input) {
        input.setAttribute("aria-invalid", "true");
        if (err && err.id) input.setAttribute("aria-describedby", err.id);
        if (!first) first = input;
      }
    });
    var msg = $(".form-msg", form);
    if (msg && (message || !first)) msg.textContent = message || "Не удалось отправить форму";
    (first || msg).focus && (first || msg).focus();
    if (!first && msg) msg.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  function done(form) {
    var reg = form.getAttribute("data-kind") === "registration";
    var box = document.createElement("div");
    box.className = "form-done";
    box.setAttribute("role", "status");
    box.setAttribute("tabindex", "-1");
    box.innerHTML = '<div class="ok" aria-hidden="true">✓</div><h3></h3><p class="muted"></p>';
    $("h3", box).textContent = reg ? "Вы зарегистрированы!" : "Заявка отправлена";
    $("p", box).textContent = reg ? "Мы отправили письмо с подтверждением на ваш e-mail. Если его нет — проверьте папку «Спам»." : "Спасибо! Мы свяжемся с вами в течение рабочего дня.";
    form.replaceWith(box);
    box.focus();
    goal(reg ? "registration" : "contact_request");
  }

  $$("form.js-form").forEach(function (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      clearErrors(form);
      var data = {};
      $$("input,select,textarea", form).forEach(function (el) {
        if (!el.name || el.disabled) return;
        if (el.type === "checkbox") { data[el.name] = el.checked; return; }
        if (el.type === "radio") { if (el.checked) data[el.name] = el.value; return; }
        data[el.name] = el.value.trim();
      });
      var btn = $("button[type=submit]", form);
      if (btn) { btn.disabled = true; btn.dataset.label = btn.textContent; btn.textContent = "Отправляем…"; }
      fetch(form.getAttribute("action"), {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" },
        body: JSON.stringify(data),
        credentials: "same-origin"
      }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (body) { return { ok: r.ok, status: r.status, body: body }; });
      }).then(function (res) {
        if (res.ok) return done(form);
        var b = res.body || {};
        showErrors(form, b.fields, b.fields && Object.keys(b.fields).length ? (res.status === 409 ? b.error : "") : (b.error || "Не удалось отправить форму. Попробуйте ещё раз."));
      }).catch(function () {
        showErrors(form, null, "Нет связи с сервером. Проверьте интернет и попробуйте ещё раз.");
      }).then(function () {
        if (btn && btn.isConnected) { btn.disabled = false; btn.textContent = btn.dataset.label; }
      });
    });
  });
})();
