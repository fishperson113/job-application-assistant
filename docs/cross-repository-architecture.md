# Cross-Repository Architecture

The Job Application Assistant is deliberately maintained in a separate repository from Corsair Platform.

- Platform repo: integration/control plane
- Workload repo: job application business domain
- Local platform checkout: `clients/job-application` Git submodule
- Runtime dependency: versioned `@corsair-platform/client`, not a source import across repositories

This preserves independent releases, reusable platform APIs, and open-source boundaries.
