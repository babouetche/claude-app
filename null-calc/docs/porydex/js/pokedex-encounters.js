var PokedexEncountersPanel = PokedexResultPanel.extend({
  initialize: function (id) {
    id = toID(id);
    var location = BattleLocationdex[id];
    this.id = id;
    this.shortTitle = location.name;

    var buf = '<div class="pfx-body dexentry">';

    buf +=
      '<a href="/" class="pfx-backbutton" data-target="back"><i class="fa fa-chevron-left"></i> Pok&eacute;dex</a>';
    buf +=
      '<h1><a href="/encounters/' +
      id +
      '" data-target="push" class="subtle">' +
      location.name +
      "</a></h1>";

    // distribution
    buf += '<ul class="utilichart metricchart nokbd">';
    buf += "</ul>";

    buf += "</div>";

    this.html(buf);

    setTimeout(this.renderDistribution.bind(this));
  },
  formatEncounterTag: function (rate, minLvl, maxLvl) {
    var tag = rate + "%";
    if (minLvl == null || maxLvl == null) return tag;
    if (minLvl === maxLvl) return tag + " Lv " + minLvl;
    return tag + " Lv " + minLvl + "-" + maxLvl;
  },
  getDistribution: function () {
    if (this.results) return this.results;

    var landRates = BattleLocationdex["rates"]["land"];
    var surfRates = BattleLocationdex["rates"]["surf"];
    var rockRates = BattleLocationdex["rates"]["rock"];
    var oldRodRates = BattleLocationdex["rates"]["fish"]["old"];
    var goodRodRates = BattleLocationdex["rates"]["fish"]["good"];
    var superRodRates = BattleLocationdex["rates"]["fish"]["super"];

    var location = this.id;
    var results = [];

    var pushHeader = function (type) {
      results.push({ kind: "header", type: type });
    };
    var pushEncounters = function (type, encounters, rates, start) {
      if (!encounters || !encounters.length) return;
      pushHeader(type);
      for (let i = 0; i < rates.length; i++) {
        let enc = encounters[i + (start || 0)];
        if (!enc) continue;
        results.push({
          kind: "pokemon",
          type: type,
          species: enc.species,
          rate: rates[i],
          minLvl: enc.minLvl,
          maxLvl: enc.maxLvl,
        });
      }
    };

    pushEncounters("L", BattleLocationdex[location]["land"]["encs"], landRates);
    pushEncounters("W", BattleLocationdex[location]["surf"]["encs"], surfRates);
    pushEncounters("R", BattleLocationdex[location]["rock"]["encs"], rockRates);

    if (BattleLocationdex[location]["fish"]["encs"] !== undefined) {
      var oldStart = 0;
      pushEncounters(
        "O",
        BattleLocationdex[location]["fish"]["encs"],
        oldRodRates,
        oldStart,
      );

      var goodStart = oldRodRates.length + oldStart;
      pushEncounters(
        "G",
        BattleLocationdex[location]["fish"]["encs"],
        goodRodRates,
        goodStart,
      );

      var superStart = goodRodRates.length + goodStart;
      pushEncounters(
        "S",
        BattleLocationdex[location]["fish"]["encs"],
        superRodRates,
        superStart,
      );
    }

    return (this.results = results);
  },
  renderDistribution: function () {
    var results = this.getDistribution();
    this.$chart = this.$(".utilichart");

    if (results.length > 1600 / 33) {
      this.streamLoading = true;
      this.$el.on("scroll", this.handleScroll.bind(this));

      var panelTop = this.$el.children().offset().top;
      var panelHeight = this.$el.outerHeight();
      var chartTop = this.$chart.offset().top;
      var scrollLoc = (this.scrollLoc = this.$el.scrollTop());

      var start = Math.floor((scrollLoc - (chartTop - panelTop)) / 33 - 35);
      var end = Math.floor(start + 35 + panelHeight / 33 + 35);
      if (start < 0) start = 0;
      if (end > results.length - 1) end = results.length - 1;
      (this.start = start), (this.end = end);

      // distribution
      var buf = "";
      for (var i = 0, len = results.length; i < len; i++) {
        buf +=
          '<li class="result">' +
          this.renderRow(i, i < start || i > end) +
          "</li>";
      }
      this.$chart.html(buf);
    } else {
      var buf = "";
      for (var i = 0, len = results.length; i < len; i++) {
        buf += '<li class="result">' + this.renderRow(i) + "</li>";
      }
      this.$chart.html(buf);
    }
  },
  renderRow: function (i, offscreen) {
    var entry = this.results[i];
    if (entry.kind === "header") {
      switch (entry.type) {
        case "L":
          return "<h3>Land</h3>";
        case "W":
          return "<h3>Surfing</h3>";
        case "R":
          return "<h3>Rock Smash</h3>";
        case "O":
          return "<h3>Old Rod</h3>";
        case "G":
          return "<h3>Good Rod</h3>";
        case "S":
          return "<h3>Super Rod</h3>";
      }
      return '<pre>error: "' + entry.type + '"</pre>';
    }

    var template = BattlePokedex[entry.species];
    if (!template) {
      return '<pre>error: "' + entry.species + '"</pre>';
    }
    if (offscreen) {
      return (
        "" +
        template.name +
        " " +
        template.abilities["0"] +
        " " +
        (template.abilities["1"] || "") +
        " " +
        (template.abilities["H"] || "") +
        ""
      );
    }
    return BattleSearch.renderTaggedLocationRowInner(
      template,
      this.formatEncounterTag(entry.rate, entry.minLvl, entry.maxLvl),
      "",
      "encountertagcol",
    );
  },
  handleScroll: function () {
    var scrollLoc = this.$el.scrollTop();
    if (Math.abs(scrollLoc - this.scrollLoc) > 20 * 33) {
      this.renderUpdateDistribution();
    }
  },
  debouncedPurgeTimer: null,
  renderUpdateDistribution: function (fullUpdate) {
    if (this.debouncedPurgeTimer) {
      clearTimeout(this.debouncedPurgeTimer);
      this.debouncedPurgeTimer = null;
    }

    var panelTop = this.$el.children().offset().top;
    var panelHeight = this.$el.outerHeight();
    var chartTop = this.$chart.offset().top;
    var scrollLoc = (this.scrollLoc = this.$el.scrollTop());

    var results = this.results;

    var rowFit = Math.floor(panelHeight / 33);

    var start = Math.floor((scrollLoc - (chartTop - panelTop)) / 33 - 35);
    var end = start + 35 + rowFit + 35;
    if (start < 0) start = 0;
    if (end > results.length - 1) end = results.length - 1;

    var $rows = this.$chart.children();

    if (
      fullUpdate ||
      start < this.start - rowFit - 30 ||
      end > this.end + rowFit + 30
    ) {
      var buf = "";
      for (var i = 0, len = results.length; i < len; i++) {
        buf +=
          '<li class="result">' +
          this.renderRow(i, i < start || i > end) +
          "</li>";
      }
      this.$chart.html(buf);
      (this.start = start), (this.end = end);
      return;
    }

    if (start < this.start) {
      for (var i = start; i < this.start; i++) {
        $rows[i].innerHTML = this.renderRow(i);
      }
      this.start = start;
    }

    if (end > this.end) {
      for (var i = this.end + 1; i <= end; i++) {
        $rows[i].innerHTML = this.renderRow(i);
      }
      this.end = end;
    }

    if (this.end - this.start > rowFit + 90) {
      var self = this;
      this.debouncedPurgeTimer = setTimeout(function () {
        self.renderUpdateDistribution(true);
      }, 1000);
    }
  },
});
