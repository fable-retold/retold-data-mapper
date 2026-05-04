# Vendored copy of pict-section-dashboard

This is a snapshot of `modules/pict/pict-section-dashboard/source/`
copied into the data-mapper because the docker build context only
includes this directory — the canonical sibling module isn't visible
inside the container at build time.

When pict-section-dashboard changes, refresh this vendor copy:

    rm -rf source && cp -R ../../../../../../pict/pict-section-dashboard/source ./

Once pict-section-dashboard is published to npm (or the docker build
context expands to include the monorepo root) this vendored copy can
be deleted in favor of a normal `require('pict-section-dashboard')`.
