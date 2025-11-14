---
layout: page
title: Unsere Sponsoren
permalink: /sponsoren/
menu-order: 6
---

Wir danken unseren Sponsoren für ihre großzügige Unterstützung! Durch ihr Engagement können wir unsere Kita und die Angebote für unsere Kinder stetig verbessern.

<div class="sponsors-container">
{% if site.data.sponsors.sponsors.size > 0 %}
  {% for sponsor in site.data.sponsors.sponsors %}
  <div class="sponsor-card">
    {% if sponsor.logo %}
    <div class="sponsor-logo">
      <img src="{{ sponsor.logo | relative_url }}" alt="{{ sponsor.name }} Logo">
    </div>
    {% endif %}
    <div class="sponsor-content">
      <h3 class="sponsor-name">
        {% if sponsor.website %}
        <a href="{{ sponsor.website }}" target="_blank" rel="noopener noreferrer">{{ sponsor.name }}</a>
        {% else %}
        {{ sponsor.name }}
        {% endif %}
      </h3>
      {% if sponsor.description %}
      <p class="sponsor-description">{{ sponsor.description }}</p>
      {% endif %}
      {% if sponsor.support %}
      <div class="sponsor-support">
        <strong>Unterstützung:</strong> {{ sponsor.support }}
      </div>
      {% endif %}
      {% if sponsor.website %}
      <p class="sponsor-website">
        <a href="{{ sponsor.website }}" target="_blank" rel="noopener noreferrer">
          <i class="fas fa-external-link-alt"></i> Website besuchen
        </a>
      </p>
      {% endif %}
    </div>
  </div>
  {% endfor %}
{% else %}
  <p class="no-sponsors">Derzeit sind noch keine Sponsoren eingetragen.</p>
{% endif %}
</div>

---

### Sie möchten Sponsor werden?

Wir freuen uns über jede Form der Unterstützung! Wenn Sie die Kita Knirpsenstadt als Sponsor unterstützen möchten, nehmen Sie gerne [Kontakt](/impressum/) mit uns auf.

