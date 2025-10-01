# 2. Use a monorepo for BärGPT

## Status

- 2025-10-01: Drafted

## Context

Using different repositories for each BärGPT component has led to challenges in managing dependencies,
writing tests across multiple projects, coordinating releases, and ensuring consistency across the project.

## Decision

We will merge the frontend, admin-panel, and backend repositories into a single monorepo.

## Consequences

This will simplify dependency management, testing, and deployment processes. 
However, it may introduce some complexity in managing the monorepo itself.