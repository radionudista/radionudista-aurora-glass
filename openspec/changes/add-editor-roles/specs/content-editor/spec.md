## ADDED Requirements

### Requirement: Editor role assignment

The system SHALL store each authenticated editor user in `editor_profiles` with role `admin` or `editor`. Users with role `editor` MUST have exactly one `program_id` referencing a `content_items` row with `content_kind = program`. Users with role `admin` MUST have `program_id` NULL.

#### Scenario: Editor assigned to program

- **WHEN** an admin creates a user with role `editor` and program `chicas-malas`
- **THEN** that user can upsert only rows for program `chicas-malas` and related episodes

#### Scenario: Editor blocked on other program

- **WHEN** an editor assigned to program A attempts to update content for program B
- **THEN** the database RLS denies the write

### Requirement: Admin user management

The system SHALL expose `/admin/usuarios` for users with role `admin` to list, create, disable, and assign programs to editor users.

#### Scenario: Non-admin denied

- **WHEN** a user with role `editor` opens `/admin/usuarios`
- **THEN** they are redirected away from the admin panel

### Requirement: Editorial content restricted to admin

The system SHALL allow updates to `site_editorial` and `home-hero` storage only for role `admin`.

#### Scenario: Editor cannot edit home copy

- **WHEN** an editor is authenticated and visits the home page
- **THEN** inline editorial controls are not shown
