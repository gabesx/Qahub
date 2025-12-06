# Project Page Refactoring

This document describes the refactoring of the large `page.tsx` file (3136 lines) into smaller, maintainable modules.

## Structure

```
apps/web/app/projects/[id]/
├── page.tsx                    # Main page (simplified, ~500 lines)
├── types.ts                    # TypeScript interfaces
├── components/
│   ├── PaginationControls.tsx  # Reusable pagination component
│   ├── PageSizeSelector.tsx    # Page size selector component
│   ├── SquadsTab.tsx           # Squads tab component
│   ├── TestPlansTab.tsx        # Test Plans tab component
│   ├── TestSuitesTab.tsx       # Test Suites tab component
│   ├── TestCasesTab.tsx        # Test Cases tab component
│   ├── AutomationTab.tsx       # Automation tab component
│   ├── DeleteProjectModal.tsx  # Delete project modal
│   ├── DeleteRepositoryModal.tsx # Delete repository modal
│   ├── DeleteTestPlanModal.tsx # Delete test plan modal
│   ├── ImportTestCasesModal.tsx # Import test cases modal
│   └── TestCaseDetailModal.tsx # Test case detail modal
├── hooks/
│   ├── useProject.ts           # Project data fetching hook
│   ├── useRepositories.ts      # Repositories data fetching hook
│   ├── useTestPlans.ts         # Test plans data fetching hook
│   ├── useTestSuites.ts        # Test suites data fetching hook
│   ├── useTestCases.ts         # Test cases data fetching hook
│   └── useAutomatedTestCases.ts # Automated test cases hook
└── utils/
    ├── parseCSV.ts             # CSV parsing utility
    └── formatTimeAgo.ts        # Time formatting utility
```

## Benefits

1. **Maintainability**: Each component has a single responsibility
2. **Reusability**: Components can be reused in other pages
3. **Testability**: Smaller components are easier to test
4. **Readability**: Main page is much cleaner and easier to understand
5. **Performance**: Components can be optimized individually

## Migration Path

1. ✅ Created types file
2. ✅ Extracted utility functions
3. ✅ Created shared components (PaginationControls, PageSizeSelector)
4. ⏳ Extract tab components (in progress)
5. ⏳ Extract modal components
6. ⏳ Create custom hooks
7. ⏳ Refactor main page.tsx

