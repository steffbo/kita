---
layout: page
title: Kalender
permalink: /kalender/
menu-order: -1
---

<div id="events-list" data-events-list>
  <script type="application/json" data-events>
    { "events": {{
      site.data.closures.events | concat: site.data.festivities.events | concat: site.data.events.events | jsonify
    }} }
  </script>
</div>

<script src="{{ '/assets/js/events-list.js' | relative_url }}"></script>

