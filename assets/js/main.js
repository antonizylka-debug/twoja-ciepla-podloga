(function(){
  "use strict";

  /* Header shrink / shadow on scroll */
  var header = document.querySelector(".site-header");
  if(header){
    var onScroll = function(){
      if(window.scrollY > 12){ header.classList.add("is-scrolled"); }
      else{ header.classList.remove("is-scrolled"); }
    };
    document.addEventListener("scroll", onScroll, { passive:true });
    onScroll();
  }

  /* Mobile nav toggle */
  var toggle = document.querySelector(".nav-toggle");
  var nav = document.querySelector(".main-nav");
  if(toggle && nav && header){
    var setOpen = function(open){
      header.classList.toggle("is-nav-open", open);
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      toggle.setAttribute("aria-label", open ? "Zamknij menu" : "Otwórz menu");
    };
    toggle.addEventListener("click", function(){
      setOpen(!header.classList.contains("is-nav-open"));
    });
    nav.addEventListener("click", function(e){
      if(e.target.tagName === "A"){ setOpen(false); }
    });
    document.addEventListener("click", function(e){
      if(header.classList.contains("is-nav-open") && !header.contains(e.target)){ setOpen(false); }
    });
    document.addEventListener("keydown", function(e){
      if(e.key === "Escape"){ setOpen(false); }
    });
    window.addEventListener("resize", function(){
      if(window.innerWidth > 1300){ setOpen(false); }
    });
  }

  /* Scroll reveal */
  var revealEls = document.querySelectorAll(".reveal");
  if("IntersectionObserver" in window && revealEls.length){
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        if(entry.isIntersecting){
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        }
      });
    }, { threshold:.14, rootMargin:"0px 0px -40px 0px" });
    revealEls.forEach(function(el, i){
      el.style.setProperty("--i", i % 6);
      io.observe(el);
    });
    /* Safety net: never leave content invisible if the observer stalls */
    setTimeout(function(){
      revealEls.forEach(function(el){ el.classList.add("is-visible"); });
    }, 2500);
  } else {
    revealEls.forEach(function(el){ el.classList.add("is-visible"); });
  }

  /* Animated stat counters */
  var counters = document.querySelectorAll("[data-count-to]");
  if("IntersectionObserver" in window && counters.length){
    var counted = new WeakSet();
    var countIo = new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        if(entry.isIntersecting && !counted.has(entry.target)){
          counted.add(entry.target);
          animateCount(entry.target);
        }
      });
    }, { threshold:.5 });
    counters.forEach(function(el){ countIo.observe(el); });
  }

  function animateCount(el){
    var target = parseFloat(el.getAttribute("data-count-to"));
    var suffix = el.getAttribute("data-suffix") || "";
    var duration = 1400;
    var start = null;
    function step(ts){
      if(start === null) start = ts;
      var progress = Math.min((ts - start) / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3);
      var value = Math.round(target * eased);
      el.textContent = value.toLocaleString("pl-PL") + suffix;
      if(progress < 1){ requestAnimationFrame(step); }
    }
    requestAnimationFrame(step);
  }

  /* Knowledge base: highlight active TOC entry */
  var tocLinks = document.querySelectorAll(".kb-toc a");
  var kbSections = document.querySelectorAll(".kb-section");
  if("IntersectionObserver" in window && tocLinks.length && kbSections.length){
    var tocIo = new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        var id = entry.target.getAttribute("id");
        var link = document.querySelector('.kb-toc a[href="#' + id + '"]');
        if(!link) return;
        if(entry.isIntersecting){
          tocLinks.forEach(function(l){ l.classList.remove("is-active"); });
          link.classList.add("is-active");
        }
      });
    }, { rootMargin:"-40% 0px -50% 0px" });
    kbSections.forEach(function(sec){ tocIo.observe(sec); });
  }

  /* ==========================================================================
     Planer petli — rysuje uklad rur i liczy metry z geometrii rysunku.
     Petla to slimak (spirala przeciwbiezna): zasilanie idzie do srodka
     co drugi zwoj, a powrot wraca pomiedzy zwojami zasilania.
     Rura 16 mm nie gnie sie pod katem prostym, wiec kazdy zakret ma promien.
     Zasada z budowy: okolo 10 m2 na jedna petle, bez narzutu procentowego.
     ========================================================================== */
  var planSvg = document.getElementById("planSvg");
  if(planSvg){
    var NS = "http://www.w3.org/2000/svg";
    /* Limit wielkosci petli liczony w m2 ekwiwalentnych: powierzchnia
       pola plus dojazd przeliczony na m2. Przy rozstawie s jeden metr
       rury odpowiada s metrom kwadratowym podlogi, wiec 10 m dojazdu
       przy 15 cm to 1,5 m2. Pompa ciepla pracuje na nizszej
       temperaturze zasilania, wiec jej petle musza byc krotsze.        */
    var LIMITY = { pompa: 10, gaz: 12 };
    var M2_NA_DZIEN = 100;    /* montaz do 100 m2 = 1 dzien */
    var MAX_PETLA = 90;       /* m — powyzej ostrzegamy  */

    var el = function(id){ return document.getElementById(id); };
    var fmt = function(n, d){ return n.toFixed(d || 0).replace(".", ","); };
    var xy = function(p){ return p[0].toFixed(3) + " " + p[1].toFixed(3); };
    var dist = function(a, b){ return Math.hypot(b[0] - a[0], b[1] - a[1]); };

    /* polilinia z zaokraglonymi zakretami (promien r) */
    var sciezka = function(pts, r){
      var p = pts.filter(function(q, i){ return i === 0 || dist(q, pts[i - 1]) > 0.001; });
      if(p.length < 2){ return ""; }
      if(p.length < 3){ return "M" + p.map(xy).join(" L"); }

      var d = "M" + xy(p[0]);
      for(var i = 1; i < p.length - 1; i++){
        var p0 = p[i - 1], p1 = p[i], p2 = p[i + 1];
        var d1 = dist(p0, p1), d2 = dist(p1, p2);
        var rr = Math.min(r, d1 / 2, d2 / 2);
        var a = [p1[0] + (p0[0] - p1[0]) / d1 * rr, p1[1] + (p0[1] - p1[1]) / d1 * rr];
        var b = [p1[0] + (p2[0] - p1[0]) / d2 * rr, p1[1] + (p2[1] - p1[1]) / d2 * rr];
        d += " L" + xy(a) + " Q" + xy(p1) + " " + xy(b);
      }
      return d + " L" + xy(p[p.length - 1]);
    };

    /* Prostokatna spirala do srodka. Kazdy zwoj jest pelny (cztery boki),
       wiec konczy sie tam, gdzie sie zaczal, tylko o skok blizej srodka.

       W wydluzonym pomieszczeniu zwoje wyczerpuja sie najpierw w krotszej
       osi. Wtedy ostatni zwoj nie jest juz prostokatem, tylko prosta
       biegnaca srodkiem — i to wlasnie tworzy dlugi waski nawrot w srodku
       petli. Zasilanie klada sie po jednej stronie osi, powrot po drugiej,
       w odleglosci rozstawu.                                              */
    var spirala = function(L, R, T, B, skok, obrotow, odsun){
      var pts = [];
      var cx = (L + R) / 2 + odsun;
      var cy = (T + B) / 2 + odsun;

      for(var k = 0; k < obrotow; k++){
        var l = L + k * skok, r = R - k * skok;
        var t = T + k * skok, b = B - k * skok;

        var waskiPion = (b - t) < skok / 2;
        var waskiPoziom = (r - l) < skok / 2;

        if(waskiPion && waskiPoziom){ break; }

        if(waskiPion){
          /* zostala prosta wzdluz dluzszego boku */
          pts.push([l, cy], [r, cy]);
          break;
        }
        if(waskiPoziom){
          pts.push([cx, t], [cx, b]);
          break;
        }

        pts.push([l, t], [r, t], [r, b], [l, b]);

        /* wyjscie lewym bokiem na poziom nastepnego zwoju */
        var nastepny = t + skok;
        if(nastepny < b){ pts.push([l, nastepny]); }
      }
      return pts;
    };

    /* slimak: spirala zasilania + powrot pomiedzy jej zwojami */
    var slimak = function(x, y, w, h, s){
      var m = s / 2;
      var L = x + m, R = x + w - m, T = y + m, B = y + h - m;
      if(R <= L || B <= T){ return []; }

      /* Tyle pelnych zwojow miesci sie w pomieszczeniu. Obie polowki petli
         dostaja te sama liczbe, dzieki czemu ich konce spotykaja sie
         w srodku i domykaja krotkim nawrotem — tak jak na budowie.        */
      var obrotow = Math.max(1, Math.floor((Math.min(R - L, B - T) - s) / (2 * s)));

      var zasilanie = spirala(L, R, T, B, 2 * s, obrotow, -s / 2);
      var powrot = spirala(L + s, R - s, T + s, B - s, 2 * s, obrotow, s / 2);
      powrot.reverse();

      /* NAWROT W SRODKU

         Zasilanie i powrot koncza sie dwoma rownoleglymi odcinkami
         oddalonymi o rozstaw. Zeby zlaczyl je czysty polokragly zawrot,
         wystarczy zrownac je na koncu: skracamy albo wydluzamy OSTATNI
         odcinek zasilania wzdluz jego wlasnej osi, tak by konczyl sie
         dokladnie naprzeciw poczatku powrotu.

         Wazne: nie ruszamy punktow powrotu. Wczesniej je przesuwalem
         i pierwszy odcinek powrotu robil sie ukosny — stad te dziwne
         zjazdy w srodku petli.                                            */
      var a = zasilanie[zasilanie.length - 1];
      var aP = zasilanie[zasilanie.length - 2];
      var b = powrot[0];
      var bN = powrot[1];

      if(a && aP && b && bN){
        var zasPoziomy = Math.abs(aP[1] - a[1]) < 0.001;
        var powPoziomy = Math.abs(bN[1] - b[1]) < 0.001;

        if(zasPoziomy && powPoziomy){
          /* oba odcinki poziome: caly ostatni odcinek zasilania przesuwamy
             na odleglosc dokladnie jednego rozstawu od powrotu, zeby
             przerwa w srodku byla taka sama jak miedzy zwojami */
          var kier = a[1] > b[1] ? 1 : -1;
          var docelowaY = b[1] + kier * s;
          aP[1] = docelowaY;
          a[1] = docelowaY;
          a[0] = b[0];
        } else if(!zasPoziomy && !powPoziomy){
          var kierX = a[0] > b[0] ? 1 : -1;
          var docelowaX = b[0] + kierX * s;
          aP[0] = docelowaX;
          a[0] = docelowaX;
          a[1] = b[1];
        } else {
          /* rozne kierunki: domykamy narozem pod katem prostym */
          zasilanie.push(zasPoziomy ? [a[0], b[1]] : [b[0], a[1]]);
        }
      }

      /* split = miejsce, w ktorym zasilanie przechodzi w powrot.
         Dzieki temu rysujemy je osobnymi kolorami, jak w projekcie.    */
      return { pts: zasilanie.concat(powrot), split: zasilanie.length - 1 };
    };

    /* Meander: dlugie proste odcinki i polkoliste zawroty. Tak uklada sie
       rure w waskich pomieszczeniach, gdzie slimak nie ma sie gdzie zwinac.
       Odcinki zawsze biegna wzdluz dluzszego boku.                        */
    var meanderProsty = function(x, y, w, h, s){
      var m = s / 2;
      var x0 = x + m + s / 2, x1 = x + w - m - s / 2;
      var y0 = y + m, y1 = y + h - m;
      if(x1 <= x0 || y1 <= y0){ return []; }

      var wierszy = Math.max(1, Math.floor((y1 - y0) / s) + 1);
      var pts = [];
      for(var i = 0; i < wierszy; i++){
        var yy = y0 + i * s;
        var lewo = (i % 2 === 0);
        pts.push([lewo ? x0 : x1, yy], [lewo ? x1 : x0, yy]);
      }
      return pts;
    };

    var meander = function(x, y, w, h, s){
      if(h > w){
        /* pomieszczenie stojace: liczymy po transpozycji i odwracamy osie */
        return { pts: meanderProsty(y, x, h, w, s).map(function(p){ return [p[1], p[0]]; }), split: null };
      }
      return { pts: meanderProsty(x, y, w, h, s), split: null };
    };

    /* Rozklad pol pod petle.

       Zasada: kazda petla ma dostac tyle samo metrow razem z dojazdem.
       Petla przy rozdzielaczu ma dojazd 1 m w dwie strony, najdalsza
       moze miec 5 m — wiec ta pierwsza dostaje wiekszy kawalek podlogi,
       a ostatnia mniejszy, zeby obie wyszly na to samo.

       Dla N petli obciazenie kazdej wynosi
           E = (powierzchnia + suma dojazdow) / N
       a pole pojedynczej petli to E minus jej wlasny dojazd. Dojazd zalezy
       od polozenia pola, a polozenie od wielkosci, wiec liczymy to
       iteracyjnie — kilka przebiegow wystarcza.                           */

    /* uklada N pol o zadanych powierzchniach docelowych */
    var ulozPola = function(W, H, cele){
      var N = cele.length;
      var rzedow = Math.max(1, Math.min(N, Math.round(Math.sqrt(N * H / W))));
      var baza = Math.floor(N / rzedow), reszta = N % rzedow;

      var pola = [], y = 0, idx = 0;
      for(var r = 0; r < rzedow; r++){
        var ile = baza + (r < reszta ? 1 : 0);
        if(ile < 1){ continue; }

        var sumaRzedu = 0, j;
        for(j = 0; j < ile; j++){ sumaRzedu += cele[idx + j]; }
        var wys = sumaRzedu / W;

        var x = 0;
        for(j = 0; j < ile; j++){
          var szer = cele[idx] / wys;
          pola.push({ x:x, y:y, w:szer, h:wys, rzad:r, kol:j, wRzedzie:ile });
          x += szer;
          idx++;
        }
        y += wys;
      }
      return pola;
    };

    /* Dojazd pola przeliczony na m2. Rura dojazdowa nie grzeje pola,
       ktore obsluguje, wiec do limitu liczymy ja z waga polowy — obciaza
       petle, ale nie tak jak metry lezace w samym polu.                   */
    var WAGA_DOJAZDU = 0.5;
    var dojazdM2 = function(pole, W, H, lewy, gorny, odl, s){
      var dx = lewy ? pole.x : W - (pole.x + pole.w);
      var dy = gorny ? pole.y : H - (pole.y + pole.h);
      return 2 * (odl + dx + dy) * s * WAGA_DOJAZDU;
    };

    /* uklad zbalansowany dla zadanej liczby petli; zwraca tez obciazenie E */
    var ukladDla = function(W, H, N, lewy, gorny, odl, s){
      var m2 = W * H;
      var cele = [], i;
      for(i = 0; i < N; i++){ cele.push(m2 / N); }

      var pola = ulozPola(W, H, cele), E = m2 / N;
      for(var iter = 0; iter < 5; iter++){
        var f = pola.map(function(p){ return dojazdM2(p, W, H, lewy, gorny, odl, s); });
        var sumaF = f.reduce(function(a, b){ return a + b; }, 0);
        E = (m2 + sumaF) / N;

        var nowe = f.map(function(fi){ return Math.max(0.6, E - fi); });
        var suma = nowe.reduce(function(a, b){ return a + b; }, 0);
        cele = nowe.map(function(c){ return c * m2 / suma; });
        pola = ulozPola(W, H, cele);
      }
      return { pola:pola, E:E };
    };

    var rysuj = function(){
      var W = parseFloat(el("pD").value);
      var H = parseFloat(el("pS").value);
      var odl = parseFloat(el("pO").value);
      var s = parseFloat(el("pR").value) / 100;

      el("pDv").textContent = fmt(W, 1) + " m";
      el("pSv").textContent = fmt(H, 1) + " m";
      el("pOv").textContent = fmt(odl, 1) + " m";
      el("pRv").textContent = Math.round(s * 100) + " cm";
      el("planScale").textContent = fmt(W, 1) + " × " + fmt(H, 1) + " m";
      el("pRnote").textContent = s <= 0.11
        ? "Gęsto. Stosujemy w łazienkach i przy dużych przeszkleniach."
        : (s >= 0.18 ? "Rzadko. Tylko przy wysokiej temperaturze zasilania." : "Typowy rozstaw przy frezowaniu.");

      var m2 = W * H;
      var rog = el("pRog").value;
      var lewy = rog.charAt(0) === "l";
      var gorny = rog.charAt(1) === "g";
      var zrodlo = el("pZrodlo").value;
      var LIMIT = LIMITY[zrodlo] || 10;

      /* Dojazd przeliczony na m2 ekwiwalentne dla pola w siatce. */
      var ekwDojazdu = function(gg, r, c){
        var bw = W / gg.c, bh = H / gg.r;
        var dx = lewy ? (c + 0.5) * bw : W - (c + 0.5) * bw;
        var dy = gorny ? (r + 0.5) * bh : H - (r + 0.5) * bh;
        return 2 * (odl + dx + dy) * s;
      };

      /* Najmniejsza liczba petli, przy ktorej rowne obciazenie miesci sie
         w limicie. Dzieki temu petle sa mozliwie duze, a nie rozdrobnione. */
      var pola = null, petle = 0;
      for(var n = Math.max(1, Math.ceil(m2 / LIMIT)); n <= 80; n++){
        var kand = ukladDla(W, H, n, lewy, gorny, odl, s);
        pola = kand.pola;
        petle = kand.pola.length;
        /* Tolerancja pol metra: pokoj 10 m2 z krotkim dojazdem wychodzi
           na 10,3 i to nadal jedna petla. Dopiero realne przekroczenie
           dzieli na dwie.                                                */
        if(kand.E <= LIMIT + 0.5){ break; }
      }

      while(planSvg.childNodes.length > 1){ planSvg.removeChild(planSvg.lastChild); }

      var pad = Math.max(0.5, Math.min(W, H) * 0.18);
      planSvg.setAttribute("viewBox", (-pad) + " " + (-pad) + " " + (W + pad * 2) + " " + (H + pad * 2));
      planSvg.setAttribute("preserveAspectRatio", "xMidYMid meet");

      var add = function(tag, attrs){
        var n = document.createElementNS(NS, tag);
        for(var k in attrs){ n.setAttribute(k, attrs[k]); }
        planSvg.appendChild(n);
        return n;
      };

      add("rect", { x:0, y:0, width:W, height:H, class:"room-outline" });

      /* Korytarz na doprowadzenia. Kazda petla oddaje po polowie jego
         szerokosci z kazdej strony, dzieki czemu rury dojazdowe maja gdzie
         przejsc i nie kladziemy ich na wierzchu innej petli.              */
      var kor = Math.min(0.5, 0.08 + petle * 0.035);

      var mx = lewy ? -pad * 0.55 : W + pad * 0.55;
      var my = gorny ? kor / 2 : H - kor / 2;
      add("circle", { cx:mx, cy:my, r:Math.max(0.08, pad * 0.09), class:"manifold" });

      /* pionowy trakt przy scianie z rozdzielaczem */
      var trakt = lewy ? kor / 4 : W - kor / 4;

      var suma = 0, najdluzsza = 0, nr = 0, dojazdy = 0, maxEkw = 0;

      /* Kazda rura dojazdowa dostaje wlasny tor w korytarzu, zeby
         doprowadzenia biegly obok siebie, a nie jedno na drugim.       */
      var linii = 2 * petle;
      var rozstawTorow = Math.min(0.06, kor / (linii + 1));
      var tor = 0;

      pola.forEach(function(pole){
          nr++;
          var cw = pole.w, ch = pole.h;
          var px = pole.x, py = pole.y;

          if(pole.kol > 0){ add("line", { x1:px, y1:py, x2:px, y2:py + ch, class:"room-split" }); }
          if(pole.rzad > 0){ add("line", { x1:px, y1:py, x2:px + cw, y2:py, class:"room-split" }); }

          /* Korytarz odbieramy tylko tam, gdzie naprawde biegna rury:
             przy scianie z rozdzielaczem i wzdluz szczeliny rzedu.
             Pozostale boki petli zostaja pelne.                            */
          var scianaL = lewy && pole.kol === 0 ? kor / 2 : 0;
          var scianaP = !lewy && pole.kol === pole.wRzedzie - 1 ? kor / 2 : 0;
          var lx = px + scianaL, lw = cw - scianaL - scianaP;
          var ly = py + (gorny ? kor / 2 : 0), lh = ch - kor / 2;

          /* Zawsze slimak — tak sie to uklada na budowie. Meander zostaje
             wylacznie dla pola tak malego, ze nie miesci sie w nim zwoj.  */
          var wynik = Math.min(lw, lh) >= 3 * s
            ? slimak(lx, ly, lw, lh, s)
            : meander(lx, ly, lw, lh, s);
          var pts = wynik.pts, podzial = wynik.split;
          if(pts.length < 2){ return; }

          var dCalosc = sciezka(pts, s / 2);
          add("path", { d:dCalosc, class:"pipe-glow" });

          var dl = 0;
          if(podzial === null){
            var pj = add("path", { d:dCalosc, class:"pipe pipe-zas" });
            dl = pj.getTotalLength();
          } else {
            var pz = add("path", { d:sciezka(pts.slice(0, podzial + 1), s / 2), class:"pipe pipe-zas" });
            var pp = add("path", { d:sciezka(pts.slice(podzial), s / 2), class:"pipe pipe-pow" });
            dl = pz.getTotalLength() + pp.getTotalLength();
            add("path", { d:sciezka(pts.slice(0, podzial + 1), s / 2), class:"pipe-flow" });
          }

          suma += dl;
          var wPetli = dl;

          /* Trasa doprowadzenia: trakt przy scianie, potem szczelina
             miedzy rzedami, na koncu wejscie w naroznik petli. Zadny
             odcinek nie przechodzi po innej petli.                        */
          var szczelina = gorny ? py + kor / 4 : py + ch - kor / 4;
          [pts[0], pts[pts.length - 1]].forEach(function(cel, j){
            /* wlasny tor: pionowy przy scianie i poziomy w szczelinie */
            var t0 = (tor - (linii - 1) / 2) * rozstawTorow;
            tor++;
            /* zaraz za rozdzielaczem rozchodza sie na wlasne tory,
               dalej biegna rownolegle obok siebie                       */
            var trasa = [
              [mx, my],
              [mx + (lewy ? 0.12 : -0.12), my + t0],
              [trakt + t0, my + t0],
              [trakt + t0, szczelina + t0],
              [cel[0], szczelina + t0],
              [cel[0], cel[1]]
            ];
            var f = add("path", {
              d:sciezka(trasa, s * 0.35),
              class:"feed " + (j ? "feed-pow" : "feed-zas")
            });
            var dlF = f.getTotalLength() + odl;
            dojazdy += dlF;
            wPetli += dlF;
          });

          if(wPetli > najdluzsza){ najdluzsza = wPetli; }

          /* ekwiwalent petli: jej powierzchnia + dojazd przeliczony na m2 */
          var ekw = lw * lh + (wPetli - dl) * s;
          if(ekw > maxEkw){ maxEkw = ekw; }

          /* Etykieta petli w ramce, tak jak opisuje sie to w projekcie:
             numer, powierzchnia i rozstaw na tle, zeby nie zlewala sie
             z rurami pod spodem.                                          */
          var srX = px + cw / 2, srY = py + ch / 2;
          var fsz = Math.min(0.22, Math.min(cw, ch) * 0.085);

          var etNo = add("text", {
            x: srX, y: srY - fsz * 0.62,
            "font-size": fsz * 1.15, class:"loop-no"
          });
          etNo.textContent = "P" + nr;

          var etOpis = add("text", {
            x: srX, y: srY + fsz * 0.75,
            "font-size": fsz, class:"loop-opis"
          });
          etOpis.textContent = (lw * lh).toFixed(2).replace(".", ",") + " m² · " + Math.round(s * 100) + " cm";

          /* skalujemy dopiero po pomiarze — szerokosc znaku zalezy od fontu */
          var szer = etOpis.getBBox().width;
          var limitTxt = lw * 0.7;
          if(szer > limitTxt){
            var skala = limitTxt / szer;
            etOpis.setAttribute("font-size", fsz * skala);
            etNo.setAttribute("font-size", fsz * 1.15 * skala);
          }

          var bNo = etNo.getBBox(), bOp = etOpis.getBBox();
          var bx = Math.min(bNo.x, bOp.x), bw = Math.max(bNo.width, bOp.width);
          var by = Math.min(bNo.y, bOp.y);
          var bh = Math.max(bNo.y + bNo.height, bOp.y + bOp.height) - by;
          var pdd = fsz * 0.45;
          var tlo = add("rect", {
            x: bx - pdd, y: by - pdd * 0.6,
            width: bw + pdd * 2, height: bh + pdd * 1.2,
            rx: fsz * 0.2, class:"loop-box"
          });
          planSvg.insertBefore(tlo, etNo);
      });

      var doprowadzenie = dojazdy;

      var razem = suma + doprowadzenie;

      el("poRazem").textContent = Math.round(razem);
      el("poRozstaw").textContent = Math.round(s * 100) + " cm";
      el("poRura").textContent = Math.round(suma) + " mb";
      el("poDoj").textContent = Math.round(doprowadzenie) + " mb";
      el("poM2").textContent = fmt(m2, 1) + " m²";
      el("poPetle").textContent = petle + " szt.";
      el("poSrednia").textContent = "~" + (razem / petle).toFixed(1).replace(".", ",") + " mb";
      el("poUwaga").textContent = "największa " + maxEkw.toFixed(1).replace(".", ",") + " m² z dojazdem";
      el("poCzas").textContent = m2 <= M2_NA_DZIEN
        ? "1 dzień"
        : "około " + Math.ceil(m2 / M2_NA_DZIEN) + " dni";

      /* rura ma swoja granice — dluga petla to spadek przeplywu na koncu */
      var srednia = razem / petle;
      el("poPetlaUwaga").textContent = srednia > 90
        ? "powyżej zalecanych 90 mb"
        : "w granicach 80–100 mb";
    };

    ["pD", "pS", "pO", "pR", "pRog", "pZrodlo"].forEach(function(id){
      el(id).addEventListener("input", rysuj);
      el(id).addEventListener("change", rysuj);
    });

    document.querySelectorAll(".planer-presets button").forEach(function(b){
      b.addEventListener("click", function(){
        el("pD").value = b.dataset.d;
        el("pS").value = b.dataset.s;
        rysuj();
      });
    });

    rysuj();
  }

  /* ==========================================================================
     Ankieta wyceny — 5 krokow, z rozpiska pomieszczen po poziomach.
     Wyniku nie ubieramy w cene ani w liczbe petli: to ustalamy po ogledzinach.
     ========================================================================== */
  var ank = document.getElementById("ank");
  if(ank){
    var KROKOW = 5;
    var krok = 1;
    var poziomow = 0;

    var el = function(id){ return document.getElementById(id); };
    var kroki = ank.querySelectorAll(".ank-step");
    var box = el("ankPoziomy");
    var blad = el("ankError");

    var POZIOMY = ["Parter", "Piętro I", "Piętro II", "Poddasze", "Piwnica"];
    var WYLEWKI = ["Cementowa", "Anhydrytowa", "Nie wiem"];
    var TYPY = ["Salon", "Kuchnia", "Sypialnia", "Pokój", "Łazienka", "Przedpokój", "Garderoba", "Gabinet", "Inne"];
    var PODLOGI = ["Płytki / kamień", "Panele", "Panel winylowy", "Deska drewniana", "Jeszcze nie wiem"];

    var opcje = function(lista, pusty){
      var html = '<option value="">' + pusty + "</option>";
      lista.forEach(function(o){ html += "<option>" + o + "</option>"; });
      return html;
    };

    /* ---------- pomieszczenie ---------- */
    var dodajPokoj = function(lista){
      var nr = lista.children.length + 1;
      var wiersz = document.createElement("div");
      wiersz.className = "ank-pokoj";
      wiersz.innerHTML =
        '<span class="ank-pokoj-nr">' + nr + "</span>" +
        '<input type="text" class="p-nazwa" placeholder="Nazwa, np. Salon">' +
        '<span class="ank-metraz"><input type="number" class="p-metraz" min="1" max="500" step="0.1" inputmode="decimal" placeholder="0"></span>' +
        '<select class="p-typ">' + opcje(TYPY, "Typ") + "</select>" +
        '<select class="p-podloga">' + opcje(PODLOGI, "Wykończenie") + "</select>" +
        '<button type="button" class="ank-usun" aria-label="Usuń pomieszczenie">&minus;</button>';

      wiersz.querySelector(".ank-usun").addEventListener("click", function(){
        wiersz.remove();
        przenumeruj(lista);
        podsumuj();
      });
      lista.appendChild(wiersz);
      przenumeruj(lista);
    };

    var przenumeruj = function(lista){
      Array.prototype.forEach.call(lista.children, function(w, i){
        var nr = w.querySelector(".ank-pokoj-nr");
        if(nr){ nr.textContent = i + 1; }
      });
    };

    /* ---------- poziom ---------- */
    var dodajPoziom = function(){
      poziomow++;
      var nr = poziomow;
      var sekcja = document.createElement("div");
      sekcja.className = "ank-poziom";
      sekcja.innerHTML =
        '<div class="ank-poziom-head">' +
          '<span class="ank-poziom-tytul">Poziom ' + nr + "</span>" +
          '<select class="lv-nazwa">' + opcje(POZIOMY, "Który poziom?") + "</select>" +
          '<select class="lv-wylewka">' + opcje(WYLEWKI, "Rodzaj wylewki") + "</select>" +
          (nr > 1 ? '<button type="button" class="ank-usun lv-usun" aria-label="Usuń poziom">&minus;</button>' : "") +
        "</div>" +
        '<div class="lv-pokoje"></div>' +
        '<button type="button" class="ank-add lv-dodaj"><span class="ank-plus">+</span> Dodaj pomieszczenie</button>';

      var lista = sekcja.querySelector(".lv-pokoje");
      sekcja.querySelector(".lv-dodaj").addEventListener("click", function(){
        dodajPokoj(lista);
        podsumuj();
      });

      var usun = sekcja.querySelector(".lv-usun");
      if(usun){
        usun.addEventListener("click", function(){
          sekcja.remove();
          odswiezTytuly();
          podsumuj();
        });
      }

      box.appendChild(sekcja);
      dodajPokoj(lista);
    };

    var odswiezTytuly = function(){
      Array.prototype.forEach.call(box.children, function(s, i){
        s.querySelector(".ank-poziom-tytul").textContent = "Poziom " + (i + 1);
      });
      poziomow = box.children.length;
    };

    /* ---------- zbieranie danych ---------- */
    var zbierz = function(){
      var dane = [];
      Array.prototype.forEach.call(box.children, function(s){
        var poziom = {
          poziom: s.querySelector(".lv-nazwa").value,
          wylewka: s.querySelector(".lv-wylewka").value,
          pomieszczenia: []
        };
        Array.prototype.forEach.call(s.querySelectorAll(".ank-pokoj"), function(w){
          var m2 = parseFloat(w.querySelector(".p-metraz").value);
          if(!m2 || m2 <= 0){ return; }
          poziom.pomieszczenia.push({
            nazwa: w.querySelector(".p-nazwa").value || "bez nazwy",
            metraz: m2,
            typ: w.querySelector(".p-typ").value,
            podloga: w.querySelector(".p-podloga").value
          });
        });
        dane.push(poziom);
      });
      return dane;
    };

    var podsumuj = function(){
      var dane = zbierz();
      var m2 = 0, ile = 0;
      dane.forEach(function(p){
        p.pomieszczenia.forEach(function(r){ m2 += r.metraz; ile++; });
      });
      el("ankSuma").innerHTML = ile
        ? "Razem <b>" + ile + (ile === 1 ? " pomieszczenie" : (ile < 5 ? " pomieszczenia" : " pomieszczeń")) +
          "</b> o łącznej powierzchni <b>" + m2.toFixed(1).replace(".", ",") + " m²</b>."
        : "Dodaj pomieszczenia i wpisz ich metraż.";
      return { m2:m2, ile:ile, dane:dane };
    };

    /* ---------- nawigacja ---------- */
    var pokaz = function(n){
      krok = n;
      Array.prototype.forEach.call(kroki, function(s){
        s.classList.toggle("is-active", Number(s.dataset.step) === n);
      });
      var koniec = n > KROKOW;
      ank.querySelector(".ank-bar").hidden = koniec;
      ank.querySelector(".ank-nav").hidden = koniec;
      if(koniec){ return; }

      var p = Math.round((n / KROKOW) * 100);
      el("ankFill").style.width = p + "%";
      el("ankPct").textContent = p + "%";
      el("ankStep").textContent = n;
      el("ankBack").hidden = n === 1;
      el("ankNext").hidden = n === KROKOW;
      el("ankSend").hidden = n !== KROKOW;
      blad.classList.remove("is-shown");
    };

    var sprawdz = function(){
      var biezacy = ank.querySelector('.ank-step[data-step="' + krok + '"]');

      if(krok === 3){
        var s = podsumuj();
        if(!s.ile){
          blad.textContent = "Dodaj przynajmniej jedno pomieszczenie i wpisz jego metraż.";
          blad.classList.add("is-shown");
          return false;
        }
        var brakPoziomu = false;
        Array.prototype.forEach.call(box.children, function(sek){
          if(!sek.querySelector(".lv-nazwa").value){ brakPoziomu = true; }
        });
        if(brakPoziomu){
          blad.textContent = "Wybierz, którego poziomu dotyczy każda sekcja.";
          blad.classList.add("is-shown");
          return false;
        }
        blad.classList.remove("is-shown");
        return true;
      }

      var grupy = {}, brak = false;
      Array.prototype.forEach.call(biezacy.querySelectorAll("[required]"), function(f){
        if(f.type === "radio"){
          if(grupy[f.name]){ return; }
          grupy[f.name] = true;
          if(!ank.querySelector('input[name="' + f.name + '"]:checked')){ brak = true; }
        } else if(f.type === "checkbox"){
          if(!f.checked){ brak = true; }
        } else if(!f.value.trim()){
          brak = true;
        }
      });

      if(brak){
        blad.textContent = krok === KROKOW
          ? "Zostaw imię, telefon, miasto i zaznacz zgodę na kontakt."
          : "Wybierz jedną z opcji, żeby przejść dalej.";
        blad.classList.add("is-shown");
        return false;
      }
      blad.classList.remove("is-shown");
      return true;
    };

    var doGory = function(){
      var top = ank.getBoundingClientRect().top + window.scrollY - 100;
      if(window.scrollY > top){ window.scrollTo({ top:top, behavior:"smooth" }); }
    };

    el("ankNext").addEventListener("click", function(){
      if(!sprawdz()){ return; }
      pokaz(krok + 1);
      doGory();
    });
    el("ankBack").addEventListener("click", function(){
      pokaz(Math.max(1, krok - 1));
      doGory();
    });
    el("ankDodajPoziom").addEventListener("click", function(){
      dodajPoziom();
      podsumuj();
    });
    ank.addEventListener("change", function(){
      blad.classList.remove("is-shown");
      if(krok === 3){ podsumuj(); }
    });
    ank.addEventListener("input", function(e){
      if(e.target.classList.contains("p-metraz")){ podsumuj(); }
    });

    ank.addEventListener("submit", function(e){
      e.preventDefault();
      if(!sprawdz()){ return; }

      var s = podsumuj();
      var dane = {};
      new FormData(ank).forEach(function(v, k){ dane[k] = v; });
      dane.poziomy = s.dane;
      dane.lacznyMetraz = s.m2;

      var wiersze = "";
      s.dane.forEach(function(p){
        p.pomieszczenia.forEach(function(r){
          wiersze += '<div class="ank-wynik-row"><span>' + r.nazwa +
            (p.poziom ? " · " + p.poziom : "") + "</span><b>" +
            r.metraz.toFixed(1).replace(".", ",") + " m²</b></div>";
        });
      });
      wiersze += '<div class="ank-wynik-row suma"><span>Razem</span><b>' +
        s.m2.toFixed(1).replace(".", ",") + " m²</b></div>";
      el("ankWynik").innerHTML = wiersze;

      el("ankKontaktInfo").textContent =
        "Przygotujemy wycenę i odezwiemy się na numer " + (dane.telefon || "") + ".";

      /* === TU PODEPNIJ WYSYLKE ===
         fetch("https://formspree.io/f/TWOJ_ID", {
           method: "POST",
           headers: { "Content-Type": "application/json", "Accept": "application/json" },
           body: JSON.stringify(dane)
         });                                                                  */
      console.log("Ankieta wyceny — zgłoszenie:", dane);

      pokaz(KROKOW + 1);
      doGory();
    });

    dodajPoziom();
    podsumuj();
    pokaz(1);
  }


  /* ---------- przycisk powrotu na gore ---------- */
  var doGory = document.getElementById("doGory");
  if(doGory){
    var pokazGore = function(){
      doGory.classList.toggle("is-widoczny", window.scrollY > 900);
    };
    document.addEventListener("scroll", pokazGore, { passive:true });
    pokazGore();
    doGory.addEventListener("click", function(){
      window.scrollTo({ top:0, behavior:"smooth" });
    });
  }

  /* ==========================================================================
     POROWNYWARKA: frezowanie kontra tradycyjna podlogowka
     Zalozenia: frezowanie do 100 m2 dziennie, wylewka 5 cm o gestosci
     ok. 2200 kg/m3 daje ok. 110 kg gruzu z metra kwadratowego przy skuwaniu.
     ========================================================================== */
  var poM = document.getElementById("poM");
  if(poM){
    var poLicz = function(){
      var m = parseInt(poM.value, 10);
      var el = function(id){ return document.getElementById(id); };

      el("poMv").textContent = m + " m²";

      var dniF = Math.max(1, Math.ceil(m / 100));
      var dniT = Math.max(3, Math.ceil(m / 25) + 2);   /* skuwanie, izolacja, rury, wylewka */
      var schniecie = 24;                               /* dni, srednio 3-4 tygodnie */
      var gruzT = m * 0.11;
      var calk = Math.round(gruzT * 10) % 10 === 0;
      var gruzLiczba = calk ? String(Math.round(gruzT)) : gruzT.toFixed(1).replace(".", ",");
      /* 1 tona, 2-4 tony, 5+ ton; wartosci ulamkowe zawsze "tony" */
      var reszta = Math.round(gruzT) % 10, dziesiatki = Math.round(gruzT) % 100;
      var slowo = !calk ? "tony"
        : (Math.round(gruzT) === 1 ? "tona"
        : (reszta >= 2 && reszta <= 4 && !(dziesiatki >= 12 && dziesiatki <= 14) ? "tony" : "ton"));
      var gruz = gruzLiczba + " " + slowo;

      el("poDniF").textContent = dniF === 1 ? "1 dzień" : dniF + " dni";
      el("poDniT").textContent = dniT + " dni";
      el("poGruzF").textContent = "brak";
      el("poGruzT").textContent = "ok. " + gruz;
      el("poGotF").textContent = dniF === 1 ? "1 dniu" : dniF + " dniach";
      el("poGotT").textContent = "ok. " + Math.round((dniT + schniecie) / 7) + " tygodniach";
    };
    poM.addEventListener("input", poLicz);
    poLicz();
  }

  /* ==========================================================================
     HARMONOGRAM REMONTU
     ========================================================================== */
  var hM = document.getElementById("hM");
  if(hM){
    var hZakres = document.getElementById("hZakres");

    var hLicz = function(){
      var m = parseInt(hM.value, 10);
      var zakres = hZakres.value;
      document.getElementById("hMv").textContent = m + " m²";

      var dniFrez = Math.max(1, Math.ceil(m / 100));
      var kroki = [
        ["Oględziny albo zdjęcia posadzki", "Sprawdzamy grubość i stan wylewki oraz przebieg instalacji w podłodze.", "przed terminem"],
        ["Frezowanie rowków", "Frezarka z odciągiem pyłu wycina kanały pod rury.", dniFrez === 1 ? "1 dzień" : dniFrez + " dni"]
      ];

      var dni = dniFrez;

      if(zakres !== "frez"){
        var dniRur = Math.max(1, Math.ceil(m / 120));
        kroki.push(["Układanie rur i zamknięcie rowków", "Rura wchodzi w rowek, całość zamykamy masą termoprzewodzącą.", dniRur === 1 ? "1 dzień" : dniRur + " dni"]);
        kroki.push(["Podłączenie do rozdzielacza", "Spinamy pętle, podłączamy do źródła ciepła.", "1 dzień"]);
        kroki.push(["Próba szczelności", "Instalacja pod ciśnieniem, sprawdzamy każdą pętlę.", "w dniu podłączenia"]);
        dni += dniRur + 1;
      }

      if(zakres === "kotlownia"){
        kroki.push(["Montaż kotłowni", "Źródło ciepła, pompy, zabezpieczenia, podpięcie c.w.u.", "1–2 dni"]);
        kroki.push(["Sterowanie i szkolenie", "Listwa, termostaty, moduł internetowy, konfiguracja stref.", "1 dzień"]);
        dni += 3;
      }

      kroki.push(["Podłoga gotowa pod okładzinę", "Bez czekania na wyschnięcie jastrychu — można kłaść płytki albo panele.", "od razu"]);

      document.getElementById("harmLista").innerHTML = kroki.map(function(k){
        return "<li><em>" + k[2] + "</em><b>" + k[0] + "</b><span>" + k[1] + "</span></li>";
      }).join("");

      document.getElementById("harmSuma").textContent = dni === 1 ? "1 dzień" : dni + " dni";
    };

    hM.addEventListener("input", hLicz);
    hZakres.addEventListener("change", hLicz);
    hLicz();
  }

  /* ==========================================================================
     KONFIGURATOR STEROWANIA
     Petle liczymy jak w planerze: okolo 10 m2 na petle.
     ========================================================================== */
  var kPok = document.getElementById("kPok");
  if(kPok){
    var kM = document.getElementById("kM");
    var kTel = document.getElementById("kTel");
    var kBezp = document.getElementById("kBezp");
    var kPogoda = document.getElementById("kPogoda");

    var kLicz = function(){
      var pok = parseInt(kPok.value, 10);
      var m = parseInt(kM.value, 10);
      document.getElementById("kPokv").textContent = pok;
      document.getElementById("kMv").textContent = m + " m²";

      var petle = Math.max(pok, Math.round(m / 10));
      var strefy = pok;

      var lista = [];
      lista.push("<li><b>Listwa sterująca na " + strefy + " " + (strefy === 1 ? "strefę" : strefy < 5 ? "strefy" : "stref") + "</b> — montowana przy rozdzielaczu, zbiera sygnały z termostatów i steruje siłownikami.</li>");
      lista.push("<li><b>" + strefy + " × termostat pokojowy</b> " + (kBezp.checked ? "bezprzewodowy, bez kucia ścian pod przewody" : "przewodowy, wymaga doprowadzenia przewodu do rozdzielacza") + ".</li>");
      lista.push("<li><b>" + petle + " × siłownik termoelektryczny</b> — po jednym na każdą pętlę na belce rozdzielacza.</li>");

      if(kTel.checked){
        lista.push("<li><b>Moduł internetowy</b> — sterowanie i harmonogramy z aplikacji w telefonie, też spoza domu.</li>");
      }
      if(kPogoda.checked){
        lista.push("<li><b>Czujnik zewnętrzny i sterowanie pogodowe</b> — temperatura zasilania dobierana do pogody, zamiast stałej nastawy.</li>");
      }
      lista.push("<li><b>Konfiguracja stref i harmonogramów</b> plus przeszkolenie z obsługi na miejscu.</li>");

      document.getElementById("konfLista").innerHTML = lista.join("");
    };

    [kPok, kM].forEach(function(e){ e.addEventListener("input", kLicz); });
    [kTel, kBezp, kPogoda].forEach(function(e){ e.addEventListener("change", kLicz); });
    kLicz();
  }

})();
