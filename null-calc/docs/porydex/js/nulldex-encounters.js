(function () {
  "use strict";

  var orderedEncounterNames = [
    "Littleroot Town",
    "Littleroot Grove",
    "Route 101",
    "Oldale Town",
    "Oldale Grove",
    "Route 103",
    "Verdanturf Tunnel",
    "Verdanturf Tunnel B1F",
    "Route 102",
    "Route 102 Grove",
    "Petalburg City",
    "Petalburg Grove",
    "Route 104",
    "Petalburg Woods",
    "Rustboro City",
    "Rustboro Grove",
    "Route 115",
    "Route 116",
    "Rusturf Tunnel",
    "Dewford Town",
    "Route 107",
    "Route 106",
    "Granite Cave 1F",
    "Granite Cave B1F",
    "Granite Cave B2F",
    "Granite Cave Steven's Room",
    "Route 109",
    "Slateport City",
    "Route 110",
    "Icicle Cave",
    "Verdanturf Town",
    "Route 117",
    "Mauville City",
    "Route 118",
    "Route 111",
    "Trainer Hill",
    "Land Cave Entrance",
    "Land Cave End",
    "Altering Cave",
    "Altering Grove",
    "Verdanturf Grotto",
    "Mirage Tower 1F",
    "Mirage Tower 2F",
    "Mirage Tower 3F",
    "Mirage Tower 4F",
    "Route 113",
    "Fallarbor Town",
    "Route 114",
    "Route 114 Underpass",
    "Meteor Falls",
    "Meteor Falls Room 2",
    "Meteor Falls B1F Room 1",
    "Meteor Falls B1F Room 2",
    "Route 112",
    "Fiery Path",
    "Mt. Chimney",
    "Jagged Pass",
    "Route 134",
    "New Mauville (Outside)",
    "New Mauville (Inside)",
    "Route 105",
    "Route 108",
    "Abandoned Ship B1F Rooms",
    "Abandoned Ship Dive Room",
    "Route 119",
    "Fortree City",
    "Route 120",
    "Route 121",
    "Lilycove City",
    "Aqua Hideout",
    "Battle Frontier",
    "Artisan Cave B1F",
    "Artisan Cave 1F",
    "Southern Island Exterior",
    "Southern Island Interior",
    "Route 122",
    "Route 123",
    "Mt. Pyre 1F",
    "Mt. Pyre 2F",
    "Mt. Pyre 3F",
    "Mt. Pyre 4F",
    "Mt. Pyre 5F",
    "Mt. Pyre 6F",
    "Mt. Pyre Exterior",
    "Mt. Pyre Summit",
    "Magma Hideout Floor 1",
    "Magma Hideout Floor 2",
    "Magma Hideout Floor 3",
    "Magma Hideout Floor 4",
    "Mossdeep City",
    "Route 125",
    "Shoal Cave (Entrance Room)",
    "Shoal Cave (Inner Room)",
    "Shoal Cave (Stairs Room)",
    "Shoal Cave (Lower Room)",
    "Shoal Cave (Ice Room)",
    "Route 127",
    "Route 126",
    "Route 126 Underwater",
    "Sootopolis City",
    "Route 128",
    "Seafloor Cavern (No Water)",
    "Seafloor Cavern (Water)",
    "Cave Of Origin Entrance",
    "Cave Of Origin 1F",
    "Route 131",
    "Pacifidlog Town",
    "Sky Pillar 1F",
    "Sky Pillar 2F",
    "Sky Pillar 3F",
    "Sky Pillar 4F",
    "Sky Pillar 5F",
    "Ever Grande City",
    "Victory Road 1F",
    "Victory Road B1F",
    "Victory Road Final Room",
    "Safari Zone South",
    "Safari Zone North",
    "Safari Zone Southwest",
    "Safari Zone Northwest",
    "Safari Zone Southeast",
    "Safari Zone Northeast",
    "Navel Rock Entrance",
    "Navel Rock B1F",
    "Navel Rock Fork",
    "Navel Rock Up 1",
    "Navel Rock Up 2",
    "Navel Rock Up 3",
    "Navel Rock Up 4",
    "Navel Rock Down 1",
    "Navel Rock Down 2",
    "Navel Rock Down 3",
    "Navel Rock Down 4",
    "Navel Rock Down 5",
  ];

  var encounterOrder = Object.create(null);
  for (var i = 0; i < orderedEncounterNames.length; i++) {
    encounterOrder[toID(orderedEncounterNames[i])] = i;
  }

  function hasOwn(obj, key) {
    return Object.prototype.hasOwnProperty.call(obj, key);
  }

  function getLocationName(id) {
    var location = BattleLocationdex[id];
    return location && location.name ? location.name : id;
  }

  function compareLocationIds(a, b) {
    var aIndex = hasOwn(encounterOrder, a) ? encounterOrder[a] : Infinity;
    var bIndex = hasOwn(encounterOrder, b) ? encounterOrder[b] : Infinity;
    if (aIndex !== bIndex) return aIndex - bIndex;
    return getLocationName(a).localeCompare(getLocationName(b));
  }

  function getOrderedLocationIds() {
    var ids = [];
    for (var id in BattleLocationdex) {
      if (id === "rates") continue;
      ids.push(id);
    }
    ids.sort(compareLocationIds);
    return ids;
  }

  function locationHasSpecies(location, speciesid) {
    if (!location) return false;
    var encounterTypes = ["land", "surf", "rock", "fish"];
    for (var i = 0; i < encounterTypes.length; i++) {
      var zone = location[encounterTypes[i]];
      var encs = zone && zone.encs;
      if (!encs) continue;
      for (var j = 0; j < encs.length; j++) {
        if (encs[j] && encs[j].species === speciesid) return true;
      }
    }
    return false;
  }

  function getFishingRate(index, rates) {
    if (index < rates.fish.old.length) {
      return rates.fish.old[index];
    }
    index -= rates.fish.old.length;
    if (index < rates.fish.good.length) {
      return rates.fish.good[index];
    }
    index -= rates.fish.good.length;
    return rates.fish.super[index] || 0;
  }

  function getZoneEncounter(location, encounterType, pokemon, rates) {
    var zone = location[encounterType];
    if (!zone || !zone.encs) return null;

    var sumRate = 0;
    var minLevel = Infinity;
    var maxLevel = -Infinity;
    for (var i = 0; i < zone.encs.length; i++) {
      var slot = zone.encs[i];
      if (!slot || slot.species !== pokemon) continue;
      minLevel = Math.min(minLevel, slot.minLvl);
      maxLevel = Math.max(maxLevel, slot.maxLvl);
      if (encounterType === "fish") {
        sumRate += getFishingRate(i, rates);
      } else {
        sumRate += rates[encounterType][i] || 0;
      }
    }

    if (!sumRate) return null;
    return {
      rate: sumRate,
      minLvl: minLevel,
      maxLvl: maxLevel,
    };
  }

  function formatEncounterTag(rate, minLvl, maxLvl) {
    var tag = rate + "%";
    if (minLvl == null || maxLvl == null) return tag;
    if (minLvl === maxLvl) return tag + " Lv " + minLvl;
    return tag + " Lv " + minLvl + "-" + maxLvl;
  }

  if (window.BattleSearch && BattleSearch.prototype.setType) {
    var originalSetType = BattleSearch.prototype.setType;
    BattleSearch.prototype.setType = function (qType, format, set, cur) {
      this.qType = qType;
      return originalSetType.call(this, qType, format, set, cur);
    };

    BattleSearch.prototype.renderTaggedEncounterRow = function (
      zone,
      tag,
      tagClass,
    ) {
      var attrs = "";
      if (BattleSearch.urlRoot) {
        attrs =
          ' href="' +
          BattleSearch.urlRoot +
          "encounters/" +
          toID(zone.name) +
          '" data-target="push"';
      }
      var buf =
        '<li class="result"><a ' +
        attrs +
        ' data-entry="encounters|' +
        BattleLog.escapeHTML(zone.name) +
        '">';
      buf +=
        '<span class="col tagcol' +
        (tagClass ? " " + tagClass : "") +
        '">' +
        tag +
        "</span> ";
      buf += '<span class="col shortmovenamecol">' + zone.name + "</span> ";
      buf += "</a></li>";
      return buf;
    };
    BattleSearch.renderTaggedEncounterRow =
      BattleSearch.prototype.renderTaggedEncounterRow;

    BattleSearch.prototype.renderTaggedLocationRowInner = function (
      pokemon,
      tag,
      errorMessage,
      tagClass,
    ) {
      var attrs = "";
      if (BattleSearch.urlRoot) {
        attrs =
          ' href="' +
          BattleSearch.urlRoot +
          "pokemon/" +
          toID(pokemon.name) +
          '" data-target="push"';
      }
      var buf =
        "<a" +
        attrs +
        ' data-entry="pokemon|' +
        BattleLog.escapeHTML(pokemon.name) +
        '">';

      buf +=
        '<span class="col tagcol shorttagcol' +
        (tagClass ? " " + tagClass : "") +
        '">' +
        tag +
        "</span> ";

      buf += '<span class="col iconcol">';
      buf += '<span style="' + Dex.getPokemonIcon(pokemon.name) + '"></span>';
      buf += "</span> ";

      var name = pokemon.name;
      var tagStart = pokemon.forme ? name.length - pokemon.forme.length - 1 : 0;
      if (tagStart) {
        name =
          name.substr(0, tagStart) +
          "<small>" +
          pokemon.name.substr(tagStart) +
          "</small>";
      }
      buf += '<span class="col shortpokemonnamecol">' + name + "</span> ";

      if (errorMessage) {
        buf += errorMessage + "</a></li>";
        return buf;
      }

      buf += '<span class="col typecol">';
      for (var i = 0; i < pokemon.types.length; i++) {
        buf += Dex.getTypeIcon(pokemon.types[i]);
      }
      buf += "</span> ";

      buf += '<span style="float:left;min-height:26px">';
      if (pokemon.abilities["1"]) {
        buf += '<span class="col twoabilitycol">';
      } else {
        buf += '<span class="col abilitycol">';
      }
      for (var abilitySlot in pokemon.abilities) {
        var ability = pokemon.abilities[abilitySlot];
        if (!ability) continue;
        if (abilitySlot === "1") buf += "<br />";
        if (abilitySlot === "H") {
          ability =
            '</span><span class="col abilitycol"><em>' +
            pokemon.abilities[abilitySlot] +
            "</em>";
        }
        buf += ability;
      }
      if (!pokemon.abilities["H"]) {
        buf += '</span><span class="col abilitycol">';
      }
      buf += "</span>";
      buf += "</span>";

      buf += '<span style="float:left;min-height:26px">';
      buf +=
        '<span class="col statcol"><em>HP</em><br />' +
        pokemon.baseStats.hp +
        "</span> ";
      buf +=
        '<span class="col statcol"><em>Atk</em><br />' +
        pokemon.baseStats.atk +
        "</span> ";
      buf +=
        '<span class="col statcol"><em>Def</em><br />' +
        pokemon.baseStats.def +
        "</span> ";
      buf +=
        '<span class="col statcol"><em>SpA</em><br />' +
        pokemon.baseStats.spa +
        "</span> ";
      buf +=
        '<span class="col statcol"><em>SpD</em><br />' +
        pokemon.baseStats.spd +
        "</span> ";
      buf +=
        '<span class="col statcol"><em>Spe</em><br />' +
        pokemon.baseStats.spe +
        "</span> ";
      var bst = 0;
      for (var stat in pokemon.baseStats) bst += pokemon.baseStats[stat];
      buf += '<span class="col bstcol"><em>BST<br />' + bst + "</em></span> ";
      buf += "</span>";

      buf += "</a>";
      return buf;
    };
    BattleSearch.renderTaggedLocationRowInner =
      BattleSearch.prototype.renderTaggedLocationRowInner;
  }

  if (window.PokedexSearchPanel && PokedexSearchPanel.prototype.updateFilters) {
    PokedexSearchPanel.prototype.updateFilters = function () {
      var buf = "";
      var qType =
        this.search.qType ||
        (this.search.engine.typedSearch && this.search.engine.typedSearch.searchType);

      if (this.search.filters) {
        for (var i = 0; i < this.search.filters.length; i++) {
          var filter = this.search.filters[i];
          var text = filter[1];
          if (filter[0] === "move") text = Dex.moves.get(text).name;
          if (filter[0] === "pokemon") text = Dex.species.get(text).name;
          buf +=
            '<button class="filter" value="' +
            Dex.escapeHTML(filter.join(":")) +
            '">' +
            text +
            ' <i class="fa fa-times-circle"></i></button> ';
        }
      }

      if (!buf) {
        this.$(".searchbox-filters").remove();
        this.$searchfilters = null;
        this.$searchbox.css("padding", "2px");
        return;
      }

      if (!this.$searchfilters) {
        this.$searchfilters = $('<div class="searchbox-filters"></div>').insertAfter(
          this.$searchbox,
        );
      }
      this.$searchfilters.html(buf);
      var filterWidth = this.$searchfilters.width();
      if (filterWidth > this.$searchbox.outerWidth() / 2) {
        this.$searchbox.css(
          "padding",
          "" + (this.$searchfilters.height() + 4) + "px 2px 2px 2px",
        );
      } else {
        this.$searchbox.css("padding", "2px 2px 2px " + (filterWidth + 6) + "px");
      }
    };
  }

  if (window.BattleTypedSearch) {
    BattleTypedSearch.prototype.isHere = function (speciesid, location) {
      if (locationHasSpecies(location, speciesid)) return true;

      if (typeof location.landslot1 !== "undefined") {
        if (location.landslot1 === speciesid) return true;
        if (location.landslot2 === speciesid) return true;
        if (location.landslot3 === speciesid) return true;
        if (location.landslot4 === speciesid) return true;
        if (location.landslot5 === speciesid) return true;
        if (location.landslot6 === speciesid) return true;
        if (location.landslot7 === speciesid) return true;
        if (location.landslot8 === speciesid) return true;
        if (location.landslot9 === speciesid) return true;
        if (location.landslot10 === speciesid) return true;
        if (location.landslot11 === speciesid) return true;
        if (location.landslot12 === speciesid) return true;
      }
      if (typeof location.fishslot1 !== "undefined") {
        if (location.fishslot1 === speciesid) return true;
        if (location.fishslot2 === speciesid) return true;
        if (location.fishslot3 === speciesid) return true;
        if (location.fishslot4 === speciesid) return true;
        if (location.fishslot5 === speciesid) return true;
        if (location.fishslot6 === speciesid) return true;
        if (location.fishslot7 === speciesid) return true;
        if (location.fishslot8 === speciesid) return true;
        if (location.fishslot9 === speciesid) return true;
        if (location.fishslot10 === speciesid) return true;
      }
      if (typeof location.waterslot1 !== "undefined") {
        if (location.waterslot1 === speciesid) return true;
        if (location.waterslot2 === speciesid) return true;
        if (location.waterslot3 === speciesid) return true;
        if (location.waterslot4 === speciesid) return true;
        if (location.waterslot5 === speciesid) return true;
      }
      if (typeof location.rockslot1 !== "undefined") {
        if (location.rockslot1 === speciesid) return true;
        if (location.rockslot2 === speciesid) return true;
        if (location.rockslot3 === speciesid) return true;
        if (location.rockslot4 === speciesid) return true;
        if (location.rockslot5 === speciesid) return true;
      }
      return false;
    };
  }

  if (window.BattleLocationSearch) {
    BattleLocationSearch.prototype.getDefaultResults = function () {
      var results = [["header", "Location"]];
      var ids = getOrderedLocationIds();
      for (var i = 0; i < ids.length; i++) {
        results.push(["location", ids[i]]);
      }
      return results;
    };
    BattleLocationSearch.prototype.getBaseResults = function () {
      return this.getDefaultResults();
    };
    BattleLocationSearch.prototype.sort = function (
      results,
      sortCol,
      reverseSort,
    ) {
      var sortOrder = reverseSort ? -1 : 1;
      if (sortCol === "name") {
        return results.sort(function (a, b) {
          return compareLocationIds(a[1], b[1]) * sortOrder;
        });
      }
      throw new Error("invalid sortcol");
    };
  }

  if (window.PokedexEncountersPanel) {
    PokedexEncountersPanel.prototype.formatEncounterTag = formatEncounterTag;
    PokedexEncountersPanel.prototype.getDistribution = function () {
      if (this.results) return this.results;

      var landRates = BattleLocationdex.rates.land;
      var surfRates = BattleLocationdex.rates.surf;
      var rockRates = BattleLocationdex.rates.rock;
      var oldRodRates = BattleLocationdex.rates.fish.old;
      var goodRodRates = BattleLocationdex.rates.fish.good;
      var superRodRates = BattleLocationdex.rates.fish.super;
      var location = this.id;
      var results = [];

      function pushEncounters(type, encounters, rates, start) {
        if (!encounters || !encounters.length) return;
        results.push({ kind: "header", type: type });
        for (var i = 0; i < rates.length; i++) {
          var enc = encounters[i + (start || 0)];
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
      }

      pushEncounters("L", BattleLocationdex[location].land.encs, landRates);
      pushEncounters("W", BattleLocationdex[location].surf.encs, surfRates);
      pushEncounters("R", BattleLocationdex[location].rock.encs, rockRates);

      if (BattleLocationdex[location].fish.encs) {
        var superStart = oldRodRates.length + goodRodRates.length;
        pushEncounters(
          "S",
          BattleLocationdex[location].fish.encs,
          superRodRates,
          superStart,
        );
      }

      return (this.results = results);
    };
    PokedexEncountersPanel.prototype.renderRow = function (i, offscreen) {
      var entry = this.results[i];
      if (entry.kind === "header") {
        switch (entry.type) {
          case "L":
            return "<h3>Land</h3>";
          case "W":
            return "<h3>Surfing</h3>";
          case "R":
            return "<h3>Rock Smash</h3>";
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
          (template.abilities["H"] || "")
        );
      }
      return BattleSearch.renderTaggedLocationRowInner(
        template,
        formatEncounterTag(entry.rate, entry.minLvl, entry.maxLvl),
        "",
        "encountertagcol",
      );
    };
  }

  if (window.PokedexPokemonPanel) {
    PokedexPokemonPanel.prototype.formatEncounterTag = formatEncounterTag;
    PokedexPokemonPanel.prototype.getEncounterLocations = function (pokemon) {
      if (this.results) return this.results;

      var rates = BattleLocationdex.rates;
      var groups = {
        A: [],
        B: [],
        C: [],
        D: [],
      };
      var locationIds = getOrderedLocationIds();

      for (var i = 0; i < locationIds.length; i++) {
        var locationId = locationIds[i];
        var encounters = BattleLocationdex[locationId];
        var land = getZoneEncounter(encounters, "land", pokemon, rates);
        var surf = getZoneEncounter(encounters, "surf", pokemon, rates);
        var rock = getZoneEncounter(encounters, "rock", pokemon, rates);
        var fish = getZoneEncounter(encounters, "fish", pokemon, rates);

        if (land) {
          groups.A.push({
            kind: "location",
            type: "A",
            location: locationId,
            rate: land.rate,
            minLvl: land.minLvl,
            maxLvl: land.maxLvl,
          });
        }
        if (surf) {
          groups.B.push({
            kind: "location",
            type: "B",
            location: locationId,
            rate: surf.rate,
            minLvl: surf.minLvl,
            maxLvl: surf.maxLvl,
          });
        }
        if (rock) {
          groups.C.push({
            kind: "location",
            type: "C",
            location: locationId,
            rate: rock.rate,
            minLvl: rock.minLvl,
            maxLvl: rock.maxLvl,
          });
        }
        if (fish) {
          groups.D.push({
            kind: "location",
            type: "D",
            location: locationId,
            rate: fish.rate,
            minLvl: fish.minLvl,
            maxLvl: fish.maxLvl,
          });
        }
      }

      var results = [];
      var groupOrder = ["A", "B", "C", "D"];
      for (var j = 0; j < groupOrder.length; j++) {
        var type = groupOrder[j];
        if (!groups[type].length) continue;
        results.push({ kind: "header", type: type });
        results.push.apply(results, groups[type]);
      }

      return (this.results = results);
    };
    PokedexPokemonPanel.prototype.renderEncounters = function () {
      var locations = this.getEncounterLocations(this.id);
      var buf = "";
      for (var i = 0; i < locations.length; i++) {
        var location = locations[i];
        if (location.kind === "header") {
          if (buf.length) buf += "</ul>";
          switch (location.type) {
            case "A":
              buf += '<li class="resultheader"><h3>Land</h3></li>';
              break;
            case "B":
              buf += '<li class="resultheader"><h3>Surfing</h3></li>';
              break;
            case "C":
              buf += '<li class="resultheader"><h3>Rock Smash</h3></li>';
              break;
            case "D":
              buf += '<li class="resultheader"><h3>Fishing</h3></li>';
              break;
            default:
              buf += '<pre>error: "' + location.type + '"</pre>';
              break;
          }
          buf += "<ul>";
        } else {
          buf += BattleSearch.renderTaggedEncounterRow(
            BattleLocationdex[location.location],
            formatEncounterTag(location.rate, location.minLvl, location.maxLvl),
            "encountertagcol",
          );
        }
      }

      if (buf.length) buf += "</ul>";
      this.$(".utilichart").html(buf);
    };
  }
})();
