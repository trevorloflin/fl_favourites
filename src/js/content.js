var branch_faves = new Set();
var branch_avoids = new Set();
var storylet_faves = new Set();
var storylet_avoids = new Set();
var card_protects = new Set();
var card_discards = new Set();
var options = {};


chrome.storage.onChanged.addListener(onStorageChange);

var event = new CustomEvent("PlayingFavouritesLoad");
window.dispatchEvent(event);

window.addEventListener("PlayingFavouritesLoad", suicide, false);

var version = chrome.runtime.getManifest().version;
console.log(`Playing Favourites ${version} injected`);

var wrapObserver = new MutationSummary({
	rootNode: document.getElementById("root"),
	callback: function(summaries) {
		if (summaries[0].added.length === 1) {
			loadData(registerObserver);
		}
	},
	queries: [{element: "#main"}]
});

// -----------------

var observer;

function registerObserver() {
  observer = new MutationSummary({
    rootNode: document.getElementById("main"),
    callback: function(summaries) {
      summaries.forEach(function(summary) {
        fillClickHandlers(function() {
          parseStorylets(true);
          parseCards();
        });
      });
    },
    queries: [{element: ".storylet"}, {element: ".hand__card-container"}] 
  });
  fillClickHandlers(function() {
    parseStorylets(true);
    parseCards();
  });
}

// Gracefully shut down orphaned instance
function suicide() {
  console.warn(`Playing Favourites ${version} content script orphaned`);
  observer.disconnect();
  window.removeEventListener("PlayingFavouritesLoad", suicide);
  document.getElementById("main").removeEventListener("click", protectAvoids, true);
}

function pageInject(func) {
  // Inject into the page context
  let s = document.createElement("script");
  s.textContent = "(" + func + ")();";
  (document.head || document.documentElement).appendChild(s);
  s.parentNode.removeChild(s);
}

// Make inline click/submit handlers visible to the isolated world
function fillClickHandlers(callback) {
  let injected = function() {
    // Note: This executes in another context!
    // Note: This assumes jQuery in the other context!
    $("[onclick]").each(function() {
      if (!this.dataset.onclick) {
        this.dataset.onclick = this.attributes.onclick.value;
      }
    });
    $("[onsubmit]").each(function() {
      if (!this.dataset.onsubmit) {
        this.dataset.onsubmit = this.attributes.onsubmit.value;
      }
    });
  };

  pageInject(injected);

  // Record original button labels
  $(".storylet input[type=submit].standard_btn, .card__discard-button").each(function() {
    if (!this.dataset.originalValue) {
      this.dataset.originalValue = this.value;
    }
  });

  callback();
}

function parseStorylets(reorder = false) { // Call without options to ensure no reordering
  let $container = $("#main");
  let $branches = $("#main .media--branch");
  let $storylets = $("#main .storylet");

  let reorder_active = false;
  let reorder_locked = false;
  if (reorder) {
    switch (options.branch_reorder_mode) {
      case "branch_no_reorder":
        break;
      case "branch_reorder_active":
        reorder_active = true;
        break;
      case "branch_reorder_all":
        reorder_active = true;
        reorder_locked = true;
        break;
    }
  }

  let $faves;
  let $avoids;

  let $first;
  let $last_active;
  let $last;

  if ($branches.length) {
    $first = $branches.first();
    $last_active = $branches.not(".media--locked").last();
    $last = $branches.last();

    $branches.each(function() {
      let match = $(this).data("branch-id");
      if (match) {
        const branchId = parseInt(match);
        const active = $(this).hasClass("media--locked");

        $(this).find(".fave_toggle_button").remove();

        if ($(this).find(".button--go").prop("offsetParent") === null) { return; } // Fix for Protector extensions

        let $toggle_button = $('<input type="image" class="fave_toggle_button" title="Playing Favourites: toggle favourite">');
        $toggle_button.insertAfter($(this).find(".button--go"));
        $toggle_button.attr("data-active", active);
        $toggle_button.attr("data-branch-id", branchId);
        $toggle_button.click(branchToggle);

        if (branch_faves.has(branchId)) {
          $(this).addClass("storylet_favourite");
          $(this).removeClass("storylet_avoid");
          $toggle_button.attr("src", chrome.runtime.getURL("img/button_filled.png"));
        } else if (branch_avoids.has(branchId)) {
          $(this).removeClass("storylet_favourite");
          $(this).addClass("storylet_avoid");
          $toggle_button.attr("src", chrome.runtime.getURL("img/button_avoid.png"));
        } else {
          $(this).removeClass("storylet_favourite");
          $(this).removeClass("storylet_avoid");
          $toggle_button.attr("src", chrome.runtime.getURL("img/button_empty.png"));
        }
      }
    });

    $faves = $branches.filter(".storylet_favourite");
    $avoids = $branches.filter(".storylet_avoid");
  } else if ($storylets.length) {
    $first = $storylets.first();
    $last_active = $storylets.not(".media--locked").last();
    $last = $storylets.last();

    $storylets.each(function() {
      let match = $(this).parent().data("branch-id");

      if (match) {
        const storyletId = parseInt(match[1]);
        const active = $(this).hasClass("media--locked");

        $(this).find(".fave_toggle_button").remove();

        if ($(this).find(".button--go").prop("offsetParent") === null) { return; } // Fix for Protector extensions

        let $toggle_button = $('<input type="image" class="fave_toggle_button" title="Playing Favourites: toggle favourite">');
        $toggle_button.insertAfter($(this).find(".button--go"));
        $toggle_button.attr("data-active", active);
        $toggle_button.attr("data-storylet-id", storyletId);
        $toggle_button.click(storyletToggle);

        if (storylet_faves.has(storyletId)) {
          $(this).addClass("storylet_favourite");
          $(this).removeClass("storylet_avoid");
          $toggle_button.attr("src", chrome.runtime.getURL("img/button_filled.png"));
        } else if (storylet_avoids.has(storyletId)) {
          $(this).removeClass("storylet_favourite");
          $(this).addClass("storylet_avoid");
          $toggle_button.attr("src", chrome.runtime.getURL("img/button_avoid.png"));
        } else {
          $(this).removeClass("storylet_favourite");
          $(this).removeClass("storylet_avoid");
          $toggle_button.attr("src", chrome.runtime.getURL("img/button_empty.png"));
        }
      }
    });

    $faves = $storylets.filter(".storylet_favourite");
    $avoids = $storylets.filter(".storylet_avoid");
  }

  if ($faves && $faves.length) {
    if (reorder_locked) {
      $faves.filter(".media--locked").insertBefore($first);
    }
    if (reorder_active) {
      $faves.not(".media--locked").insertBefore($first);
    }
  }

  if ($avoids && $avoids.length) {
    if (reorder_locked) {
      if ($last_active.length) {
        $avoids.filter(".media--locked").insertAfter($last_active);
      } else {
        $avoids.filter(".media--locked").insertBefore($last);
      }
    }
    if (reorder_active) {
      if ($last_active.length) {
        $avoids.not(".media--locked").insertAfter($last_active);
      } else {
        $avoids.not(".media--locked").insertBefore($last);
      }
    }
  }
}

function parseCards() {
  let $cards = $("#main .hand__card-container");

  $cards.each(function() {
    let match;
    if (this.dataset.eventId) {
      match = this.dataset.eventId;
    }

    if (match) {
      const cardId = parseInt(match);

      $(this).children(".card_toggle_button").remove();

      if (this.offsetParent === null) { return; } // Fix for Protector extensions

      let $toggle_button = $('<input type="image" class="card_toggle_button" title="Playing Favourites: toggle favourite">');
      $(this).append($toggle_button);

      $toggle_button.attr("data-card-id", cardId);
      //$(this).attr("data-card-id", cardId);

      $toggle_button.click(cardToggle);

	  let $discard_button = $(this).children('.card__discard-button');

      if (card_discards.has(cardId)) {
        $discard_button.addClass("card_discard");
        $discard_button.removeClass("card_protect");
        $toggle_button.attr("src", chrome.runtime.getURL("img/card_discard.png"));
      } else if (card_protects.has(cardId)) {
        $discard_button.removeClass("card_discard");
        $discard_button.addClass("card_protect");
        $toggle_button.attr("src", chrome.runtime.getURL("img/card_protect.png"));
      } else {
        $discard_button.removeClass("card_discard");
        $discard_button.removeClass("card_protect");
        $toggle_button.attr("src", chrome.runtime.getURL("img/card_empty.png"));
      }
    }
  });
}

function onStorageChange(changes, area) {
  if (area === "local") { loadData(parseStorylets); }
}

function loadData(callback) {
  chrome.storage.local.get(
    null,
    function(data) {
      branch_faves = unpackSet(data, "branch_faves");
      branch_avoids = unpackSet(data, "branch_avoids");
      storylet_faves = unpackSet(data, "storylet_faves");
      storylet_avoids = unpackSet(data, "storylet_avoids");
      card_protects = unpackSet(data, "card_protects");
      card_discards = unpackSet(data, "card_discards");

      options.branch_reorder_mode = data.branch_reorder_mode;
      options.switch_mode = data.switch_mode;
      options.protectInterval = 2000; // DUMMY

      initializeProtector();

      if (callback) { callback(); }
    }
  );
}

function restoreLabelCallback(element) {
  return function() {
    element.value = element.dataset.originalValue;
  };
}

function protectAvoids(e) {
  if (e.metaKey || e.ctrlKey) { return; } // Ctrl-click always bypasses protection

  // If clicked on branch selection OR card discard that's red
  if ($(e.target).is(".storylet_avoid input[type=submit].standard_btn, .card_protect")) {
    let time = Date.now();
    if (
      !e.target.dataset.protectTimestamp ||
      (time - e.target.dataset.protectTimestamp) >= options.protectInterval
    ) {
      // Prevent page's inline handler from firing
      e.stopImmediatePropagation();
      e.preventDefault();

      console.log("Protected!");
      e.target.value = ($(e.target).is(".card_protect")) ? "  SURE?  " : "Sure?";
      e.target.dataset.protectTimestamp = time;
      setTimeout(restoreLabelCallback(e.target), options.protectInterval);
    }
  }
}

function initializeProtector() {
  // Intercept clicks to avoided elements
  document.getElementById("main").addEventListener(
    "click",
    protectAvoids,
    true // Capture before it reaches inline onclick
  );
}

function branchToggle(e) {
  e.preventDefault();

  const branchId = parseInt(this.dataset.branchId);

  switch (options.switch_mode) {
    case "modifier_click":
      const modifier = (e.metaKey || e.ctrlKey);
      if (modifier) {
        if (branch_avoids.has(branchId)) {
          setBranchFave(branchId, "none");
        } else {
          setBranchFave(branchId, "avoid");
        }
      } else {
        if (branch_faves.has(branchId)) {
          setBranchFave(branchId, "none");
        } else {
          setBranchFave(branchId, "fave");
        }
      }
      break;
    case "click_through":
      if (branch_faves.has(branchId)) {
        setBranchFave(branchId, "avoid");
      } else if (branch_avoids.has(branchId)) {
        setBranchFave(branchId, "none");
      } else {
        setBranchFave(branchId, "fave");
      }
      break;
  }
}

function storyletToggle(e) {
  e.preventDefault();

  const storyletId = parseInt(this.dataset.storyletId);

  switch (options.switch_mode) {
    case "modifier_click":
      const modifier = (e.metaKey || e.ctrlKey);
      if (modifier) {
        if (storylet_avoids.has(storyletId)) {
          setStoryletFave(storyletId, "none");
        } else {
          setStoryletFave(storyletId, "avoid");
        }
      } else {
        if (storylet_faves.has(storyletId)) {
          setStoryletFave(storyletId, "none");
        } else {
          setStoryletFave(storyletId, "fave");
        }
      }
      break;
    case "click_through":
      if (storylet_faves.has(storyletId)) {
        setStoryletFave(storyletId, "avoid");
      } else if (storylet_avoids.has(storyletId)) {
        setStoryletFave(storyletId, "none");
      } else {
        setStoryletFave(storyletId, "fave");
      }
      break;
  }
}

function cardToggle(e) {
  e.preventDefault();

  const cardId = parseInt(this.dataset.cardId);

  switch (options.switch_mode) {
    case "modifier_click":
      const modifier = (e.metaKey || e.ctrlKey);
      if (modifier) {
        if (card_protects.has(cardId)) {
          setCardFave(cardId, "none");
        } else {
          setCardFave(cardId, "protect");
        }
      } else {
        if (card_discards.has(cardId)) {
          setCardFave(cardId, "none");
        } else {
          setCardFave(cardId, "discard");
        }
      }
      break;
    case "click_through":
      if (card_discards.has(cardId)) {
        setCardFave(cardId, "protect");
      } else if (card_protects.has(cardId)) {
        setCardFave(cardId, "none");
      } else {
        setCardFave(cardId, "discard");
      }
      break;
  }
}

function saveFaves(callback) {
  let data = {};

  Object.assign(data, branch_faves.pack("branch_faves"));
  Object.assign(data, branch_avoids.pack("branch_avoids"));
  Object.assign(data, storylet_faves.pack("storylet_faves"));
  Object.assign(data, storylet_avoids.pack("storylet_avoids"));
  Object.assign(data, card_protects.pack("card_protects"));
  Object.assign(data, card_discards.pack("card_discards"));

  chrome.storage.local.set(data, function() {
    if (callback) { callback(); }
  });
}

function setBranchFave(branchId, mode) {
  switch (mode) {
    case "none":
      branch_faves.delete(branchId);
      branch_avoids.delete(branchId);
      break;
    case "avoid":
      branch_faves.delete(branchId);
      branch_avoids.add(branchId);
      break;
    case "fave":
      branch_faves.add(branchId);
      branch_avoids.delete(branchId);
      break;
  }
  saveFaves(parseStorylets);
}

function setStoryletFave(storyletId, mode) {
  switch (mode) {
    case "none":
      storylet_faves.delete(storyletId);
      storylet_avoids.delete(storyletId);
      break;
    case "avoid":
      storylet_faves.delete(storyletId);
      storylet_avoids.add(storyletId);
      break;
    case "fave":
      storylet_faves.add(storyletId);
      storylet_avoids.delete(storyletId);
      break;
  }
  saveFaves(parseStorylets);
}

function setCardFave(cardId, mode) {
  switch (mode) {
    case "none":
      card_discards.delete(cardId);
      card_protects.delete(cardId);
      break;
    case "protect":
      card_discards.delete(cardId);
      card_protects.add(cardId);
      break;
    case "discard":
      card_discards.add(cardId);
      card_protects.delete(cardId);
      break;
  }
  saveFaves(parseCards);
}
