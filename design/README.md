# Design assets

`docs/handover/design-map.md` is the authority for canonical status, fixed commit
anchors, source availability, and old-to-new path mappings.

## Layout

- `kaleid/` — last fetched Claude Design source bundle (HTML/JSX/JS), original
  chat handoff, and the recovered full raw design conversation. The external
  projects are no longer authorized or retrievable; the repository copy is the
  source of truth.
- `archive/` — superseded source versions preserved byte-for-byte for recovery;
  every archive is explicitly non-canonical unless the design map says otherwise.
- `reference/` — rendered screenshots and time-specific before/baseline images.
  These are evidence or visual references, not editable design source.
- `prototypes/` — historical local spikes preserved for recovery. They must not
  override the current canonical design.

## Preservation rule

Any future design source obtained from an external service must be committed in
the same work session, before implementation or redesign starts. Before/current
screenshots must also be committed before the change that would destroy that
state.

The original Claude Design `uploads/` contained private WeChat images that
ByAnDa explicitly said were input-only and unnecessary for implementation.
They remain excluded from this public repository.
