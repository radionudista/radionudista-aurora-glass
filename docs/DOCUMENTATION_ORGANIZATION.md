# Documentation Organization

## Overview

This document explains how the documentation is organized in this project and establishes standards for future documentation.

## Documentation Structure

All documentation files are located in the `docs/` folder to keep the project root clean and organized.

### Current Documentation Files

#### Architecture & Code Quality
- **`SOLID_IMPROVEMENTS.md`** - Comprehensive guide on SOLID principles implementation
- **`BACKGROUND_VIDEO_IMPROVEMENTS.md`** - Background video component architecture
- **`CROSSFADE_TRANSITION.md`** - Technical details of the transition effect
- **`BACKGROUND_VIDEO_FIX.md`** - Bug fixes and behavioral improvements

#### Project Organization
- **`DOCUMENTATION_ORGANIZATION.md`** - This file, explaining documentation structure

## Documentation Standards

### Language Policy
- **Code documentation, comments, and technical docs**: English only
- **Site content**: Can be in other languages as needed
- **Variable names, function names, and code**: English only

### File Naming Convention
- Use `SCREAMING_SNAKE_CASE.md` for major documentation files
- Use descriptive names that clearly indicate the content
- Group related documentation with common prefixes when appropriate

### Content Standards
- Include a clear overview/objective section
- Use proper markdown formatting
- Include code examples when relevant
- Document technical decisions and rationale
- Keep documentation up to date with code changes

### Location Rules
- All `.md` files except `README.md` must be in the `docs/` folder
- `README.md` stays in the project root and links to docs
- No documentation files should be scattered throughout the project

## How to Add New Documentation

1. Create new `.md` files in the `docs/` folder
2. Use clear, descriptive filenames
3. Follow the established format with overview, technical details, and examples
4. Update the README.md to reference new documentation when appropriate
5. Keep all technical documentation in English

## Benefits of This Organization

- **Clean project root**: Only essential files at the top level
- **Easy to find**: All documentation in one place
- **Maintainable**: Clear standards for new documentation
- **Professional**: Consistent organization and formatting
- **Scalable**: Easy to add new documentation as the project grows

---

**Last Updated**: July 5, 2025  
**Standard**: All documentation in `docs/` folder, English for technical content
