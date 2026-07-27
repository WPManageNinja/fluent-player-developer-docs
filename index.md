---
layout: home

hero:
  name: "FluentPlayer Developer Docs"
  text: "Extend the player in code"
  tagline: Hooks, REST API, extension points, and the JS API for the FluentPlayer WordPress plugin.
  image:
    src: /logo.svg
    alt: FluentPlayer
  actions:
    - theme: brand
      text: Get Started
      link: /getting-started/
    - theme: alt
      text: Hooks & Filters
      link: /hooks/
    - theme: alt
      text: Recipes
      link: /recipes/
    - theme: alt
      text: User Docs ↗
      link: https://docs.fluentplayer.com

features:
  - title: Hooks & Filters
    details: 15 actions and 77 filters in the free plugin, plus 8 actions and 12 filters that only exist with Pro — all under the fluent_player/ prefix, every one cited to its call site.
    link: /hooks/reference
  - title: REST API
    details: 45 free routes and 102 Pro routes under /wp-json/fluent-player/v2/, grouped by policy so you can see which capability guards each one.
    link: /rest-api/
  - title: Pro & AJAX surface
    details: The routes FluentPlayer Pro adds, and the admin-ajax.php actions the frontend player calls for email capture, unlock, and analytics.
    link: /rest-api/pro
  - title: Extending FluentPlayer
    details: Build a custom email provider, integration, dynamic media source, or smartcode against the plugin's base classes.
    link: /extending/
  - title: Reference
    details: Shortcode attributes, the media CPT and email-collection table, and the capability map behind every policy.
    link: /reference/shortcodes
  - title: JS API
    details: The five window globals, the custom events, and the PHP-localized config objects behind the Vidstack-based frontend.
    link: /js-api/
  - title: Recipes
    details: Copy-paste snippets traced to their call sites and safe on the PHP 7.4 floor both plugins declare.
    link: /recipes/
---
