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

  var openSelect = null;
  function enhanceSelect(sel, n) {
    var wrap = document.createElement("div");
    wrap.className = "cselect";
    sel.parentNode.insertBefore(wrap, sel);
    wrap.appendChild(sel);
    sel.classList.add("cselect-native");
    sel.tabIndex = -1;
    sel.setAttribute("aria-hidden", "true");

    var uid = "cs" + n;
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "select cselect-btn";
    btn.id = uid + "-btn";
    btn.setAttribute("aria-haspopup", "listbox");
    btn.setAttribute("aria-expanded", "false");
    var label = sel.id ? $('label[for="' + sel.id + '"]') : null;
    if (label) {
      if (!label.id) label.id = uid + "-label";
      btn.setAttribute("aria-labelledby", label.id + " " + btn.id);
      label.addEventListener("click", function (e) { e.preventDefault(); btn.focus(); });
    } else if (sel.getAttribute("aria-label")) {
      btn.setAttribute("aria-label", sel.getAttribute("aria-label"));
    }

    var list = document.createElement("ul");
    list.className = "cselect-list";
    list.id = uid + "-list";
    list.setAttribute("role", "listbox");
    list.tabIndex = -1;
    list.hidden = true;
    btn.setAttribute("aria-controls", list.id);
    wrap.appendChild(btn);
    wrap.appendChild(list);

    var items = [];
    var active = -1;
    function build() {
      list.innerHTML = "";
      items = Array.prototype.map.call(sel.options, function (o, k) {
        var li = document.createElement("li");
        li.id = uid + "-o" + k;
        li.setAttribute("role", "option");
        li.textContent = o.textContent;
        if (o.disabled) li.setAttribute("aria-disabled", "true");
        li.addEventListener("mousedown", function (e) { e.preventDefault(); });
        li.addEventListener("click", function () { if (!o.disabled) choose(k); });
        li.addEventListener("mousemove", function () { setActive(k); });
        list.appendChild(li);
        return li;
      });
    }
    function sync() {
      var o = sel.options[sel.selectedIndex];
      btn.textContent = o ? o.textContent : "";
      btn.classList.toggle("is-placeholder", !!o && o.value === "");
      items.forEach(function (li, k) { li.setAttribute("aria-selected", k === sel.selectedIndex ? "true" : "false"); });
    }
    function setActive(k) {
      if (k < 0 || k >= items.length) return;
      if (items[active]) items[active].classList.remove("active");
      active = k;
      items[k].classList.add("active");
      list.setAttribute("aria-activedescendant", items[k].id);
      var top = items[k].offsetTop, bottom = top + items[k].offsetHeight;
      if (top < list.scrollTop) list.scrollTop = top;
      else if (bottom > list.scrollTop + list.clientHeight) list.scrollTop = bottom - list.clientHeight;
    }
    function step(from, dir) {
      for (var k = from + dir; k >= 0 && k < items.length; k += dir) if (!sel.options[k].disabled) return k;
      return from;
    }
    function open() {
      if (openSelect && openSelect !== close) openSelect();
      list.hidden = false;
      list.style.left = "";
      list.style.right = "";
      if (list.getBoundingClientRect().right > window.innerWidth - 8) { list.style.left = "auto"; list.style.right = "0"; }
      btn.setAttribute("aria-expanded", "true");
      setActive(Math.max(0, sel.selectedIndex));
      list.focus();
      openSelect = close;
    }
    function close(refocus) {
      if (list.hidden) return;
      list.hidden = true;
      btn.setAttribute("aria-expanded", "false");
      if (openSelect === close) openSelect = null;
      if (refocus) btn.focus();
    }
    function choose(k) {
      var changed = sel.selectedIndex !== k;
      sel.selectedIndex = k;
      sync();
      close(true);
      if (changed) sel.dispatchEvent(new Event("change", { bubbles: true }));
    }

    btn.addEventListener("click", function () { if (list.hidden) open(); else close(true); });
    btn.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); }
    });
    var typed = "", typedAt = 0;
    list.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown") { e.preventDefault(); setActive(step(active, 1)); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setActive(step(active, -1)); }
      else if (e.key === "Home") { e.preventDefault(); setActive(step(-1, 1)); }
      else if (e.key === "End") { e.preventDefault(); setActive(step(items.length, -1)); }
      else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (active >= 0) choose(active); }
      else if (e.key === "Escape") { e.preventDefault(); close(true); }
      else if (e.key === "Tab") { close(false); btn.focus(); }
      else if (e.key.length === 1) {
        var now = Date.now();
        typed = now - typedAt > 700 ? e.key.toLowerCase() : typed + e.key.toLowerCase();
        typedAt = now;
        for (var k = 0; k < items.length; k++) if (items[k].textContent.toLowerCase().indexOf(typed) === 0) { setActive(k); break; }
      }
    });
    list.addEventListener("blur", function () { setTimeout(function () { if (document.activeElement !== list) close(false); }, 0); });
    sel.addEventListener("focus", function () { btn.focus(); });
    sel.addEventListener("change", sync);
    if (sel.form) sel.form.addEventListener("reset", function () { setTimeout(sync, 0); });
    build();
    sync();
  }
  $$("select.select").forEach(enhanceSelect);
  document.addEventListener("click", function (e) {
    if (openSelect && !e.target.closest(".cselect")) openSelect(false);
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
  function digits(v) { return v.replace(/\D/g, ""); }
  function caretAfter(v, n) {
    if (n <= 0) return 0;
    for (var k = 0, c = 0; k < v.length; k++) if (/\d/.test(v[k]) && ++c === n) return k + 1;
    return v.length;
  }
  $$("input[type=tel]").forEach(function (i) {
    var last = i.value;
    i.addEventListener("input", function (ev) {
      var raw = i.value;
      var pos = i.selectionStart == null ? raw.length : i.selectionStart;
      var before = digits(raw.slice(0, pos)).length;
      if (ev.inputType === "deleteContentBackward" && digits(raw) === digits(last) && before > 0) {
        var d = digits(raw);
        raw = d.slice(0, before - 1) + d.slice(before);
        before -= 1;
      }
      var f = formatPhone(raw);
      var n = Math.min(digits(f).length, digits(formatPhone(digits(raw).slice(0, before))).length);
      i.value = f;
      last = f;
      if (document.activeElement === i) {
        var c = caretAfter(f, n);
        i.setSelectionRange(c, c);
      }
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
