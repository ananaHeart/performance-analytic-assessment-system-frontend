// Tech stack page content, taken from Chapter III (Technical Background) of the
// manuscript "A MOBILE AND WEB PERFORMANCE ANALYTIC ASSESSMENT SYSTEM" (CLEAN-ver2).
//
// Definitions are verbatim from Chapter III except where marked "EDITED" or "NEW".
// Approved by Heart on 2026-10-17: describe Tailwind/shadcn truthfully and add a
// Deployment group.

export const TECH_STACK_GROUPS = [
  {
    id: 'backend',
    label: 'Backend',
    description: 'The Spring Boot server that scores answer sheets, stores records, and builds reports.',
  },
  {
    id: 'web',
    label: 'Web dashboard',
    description: 'The browser app teachers and the principal use to manage classes and read reports.',
  },
  {
    id: 'mobile',
    label: 'Mobile app',
    description: 'The Android app teachers use to scan, check, and sync answer sheets, even offline.',
  },
  {
    id: 'deployment',
    label: 'Deployment',
    description: 'The cloud services that keep Marka online.',
  },
  {
    id: 'tools',
    label: 'Development tools',
    description: 'The tools the researchers used to write and track the code.',
  },
]

export const TECH_STACK = [
  // Backend
  {
    group: 'backend',
    name: 'Java',
    definition:
      'This is the programming language used to write the entire backend, including the logic that checks scanned answers, computes scores, and builds analytics reports.',
  },
  {
    group: 'backend',
    name: 'Spring Boot',
    definition:
      'This is the Java framework used to build the backend as a set of RESTful API services that the mobile app and the web dashboard connect to.',
  },
  {
    group: 'backend',
    name: 'Spring Web (Spring MVC)',
    definition:
      "This is the part of Spring Boot used to expose the backend's features as REST API endpoints, such as downloading an assigned class to the mobile app or generating a report for the web dashboard.",
  },
  {
    group: 'backend',
    name: 'Spring Security',
    definition:
      "This is the library used to check a logged-in user's role (teacher or principal) before allowing a request through, and to protect stored teacher passwords.",
  },
  {
    group: 'backend',
    name: 'Spring JDBC (JdbcTemplate)',
    definition:
      'This is the part of Spring used to connect the backend directly to the database and run the SQL statements that retrieve and save records such as students, assessments, and scanned answers.',
  },
  {
    // EDITED: Chapter III reads "before the processes it"; fixed to "before the backend processes it".
    group: 'backend',
    name: 'Jakarta Bean Validation (Spring Boot Validation)',
    definition:
      'This is the library used to check that data sent from the mobile app or the web dashboard is complete and correctly formatted before the backend processes it.',
  },
  {
    group: 'backend',
    name: 'Spring Boot Mail',
    definition:
      'This is the library used to send account verification and registration emails to newly created teacher accounts.',
  },
  {
    group: 'backend',
    name: 'Spring Boot DevTools',
    definition:
      'This is the tool used to automatically restart the backend server whenever the researchers saved a code change during development.',
  },
  {
    group: 'backend',
    name: 'MySQL / MariaDB',
    definition:
      "This is the relational database management system used to permanently store all of the system's data, such as users, classes, students, assessments, scanned answers, and analytics results.",
  },
  {
    group: 'backend',
    name: 'Apache XAMPP',
    definition:
      "This is the local server package used to run MySQL/MariaDB and phpMyAdmin on the researchers' own computers for developing and testing the backend before deployment.",
  },
  {
    group: 'backend',
    name: 'Apache PDFBox',
    definition:
      'This is the Java library used to generate the printable bubble answer sheets and the downloadable PDF reports, such as the class record and item analysis.',
  },
  {
    group: 'backend',
    name: 'Apache POI',
    definition:
      "This is the Java library used to generate the downloadable Excel (.xlsx) versions of the system's reports.",
  },
  {
    group: 'backend',
    name: 'Google ZXing (Zebra Crossing)',
    definition:
      'This is the QR code library used to generate the unique QR code printed on every answer sheet, which the mobile app scans to identify the exact test and student it belongs to, as well as the QR code used to set up two-factor authentication.',
  },
  {
    group: 'backend',
    name: 'Jackson',
    definition:
      "This is the library, bundled with Spring Web, used to convert the backend's data to and from JSON whenever it exchanges information with the mobile app or the web dashboard.",
  },
  {
    group: 'backend',
    name: 'Brevo',
    definition:
      "This is the third-party email delivery service connected to Spring Boot Mail so that verification and registration emails actually reach a teacher's real inbox.",
  },
  {
    group: 'backend',
    name: 'Maven',
    definition:
      "This is the build tool used to manage the backend's external libraries and to compile, package, and run the application.",
  },
  {
    group: 'backend',
    name: 'Postman',
    definition:
      "This is the tool used to manually test the backend's REST API endpoints during development, before the mobile app and web dashboard were connected to them.",
  },

  // Web dashboard
  {
    group: 'web',
    name: 'JavaScript (JS)',
    definition:
      'This is the language the entire web dashboard is written in, covering every page, API call, and component, using the JSX syntax extension for building UI markup; the project uses plain JavaScript, not TypeScript.',
  },
  {
    group: 'web',
    name: 'React',
    definition:
      "This is the JavaScript library used to build the dashboard's interface as reusable components (tables, modals, forms, charts), rendered via React DOM and driven by React's own state and hooks (useState, useEffect, useContext) rather than a separate state-management library.",
  },
  {
    group: 'web',
    name: 'Vite',
    definition:
      'This is the build tool and development server used to bundle the web dashboard for production and to serve it with fast reloading while the researchers were developing it.',
  },
  {
    // NEW: most live pages are styled with plain CSS and shared design tokens.
    group: 'web',
    name: 'CSS (Cascading Style Sheets)',
    definition:
      "This is the styling language used for most pages of the web dashboard, organized into shared design tokens (colors, spacing, fonts, and corner sizes) and page-specific style files so the whole dashboard keeps one consistent look.",
  },
  {
    // EDITED: Chapter III says Tailwind styles every page; it styles the assessment editor,
    // and the other pages use plain CSS.
    group: 'web',
    name: 'Tailwind CSS',
    definition:
      "This is the utility-first CSS framework, wired into the project through its official Vite plugin, used to style the assessment editor where teachers build assessments, answer keys, and rubrics; the other pages use the project's own CSS and design tokens.",
  },
  {
    // EDITED: shadcn/ui is used by the assessment editor, not by every page.
    group: 'web',
    name: 'shadcn/ui',
    definition:
      "This is the component design system used to generate the dashboard's base UI elements (buttons, inputs, selects, cards, badges, date-time pickers), built on Radix UI primitives and customized with Tailwind CSS, and used in the assessment editor.",
  },
  {
    group: 'web',
    name: 'Radix UI',
    definition:
      "This is the library of unstyled, accessible component primitives (Label, Popover, Select, Slot) that the dashboard's shadcn/ui components are built on top of, providing keyboard navigation and accessibility behavior.",
  },
  {
    group: 'web',
    name: 'class-variance-authority (CVA)',
    definition:
      "This is the utility used to define style variants, such as different button colors and sizes, for the dashboard's reusable UI components.",
  },
  {
    group: 'web',
    name: 'clsx',
    definition:
      "This is the utility used to conditionally combine CSS class names in the dashboard's components, such as toggling active or disabled styles.",
  },
  {
    group: 'web',
    name: 'tailwind-merge',
    definition:
      'This is the utility used alongside clsx to resolve conflicting Tailwind classes so that component style overrides apply correctly throughout the dashboard.',
  },
  {
    group: 'web',
    name: 'Recharts',
    definition:
      "This is the charting library used to render the report visualizations, such as item analysis and performance charts, on the dashboard's Reports page.",
  },
  {
    group: 'web',
    name: 'Lucide React',
    definition:
      "This is the icon library used for interface icons throughout the dashboard's buttons, navigation, and status indicators.",
  },
  {
    group: 'web',
    name: 'Fetch API',
    definition:
      "This is the built-in browser API used as the HTTP client for all communication between the web dashboard and the backend's REST endpoints, in place of a separate library such as Axios.",
  },
  {
    group: 'web',
    name: 'ESLint',
    definition:
      "This is the linting tool used to catch errors and enforce consistent coding rules, including React Hooks usage, in the dashboard's source code.",
  },

  // Mobile app
  {
    group: 'mobile',
    name: 'React Native',
    definition:
      'This is the cross-platform mobile application framework the researchers used to build the entire teacher-facing mobile app, compiling the JavaScript/TypeScript source into a native Android application for scanning, verifying, and syncing test results.',
  },
  {
    // EDITED: Chapter III stops mid-sentence at "on a"; completed as "on a teacher's phone".
    group: 'mobile',
    name: 'TypeScript (TS)',
    definition:
      "This is the typed superset of JavaScript the researchers used to write the mobile app's source code, catching type mismatches, such as in the data sent to the backend during sync, at compile time before they could cause a failure on a teacher's phone.",
  },
  {
    group: 'mobile',
    name: 'React',
    definition:
      "This is the underlying UI library React Native is built on, used throughout the app to manage each screen's state and re-render it automatically whenever the teacher's data changes, such as the student list, scan-review screen, and synchronization screen.",
  },
  {
    group: 'mobile',
    name: 'Kotlin',
    definition:
      "This is the language the researchers used to write the mobile app's custom native Android modules, namely the OMR bubble/QR-code detector, the camera-capture bridge, and the secure session-storage module, for functionality that JavaScript alone cannot perform on the device.",
  },
  {
    group: 'mobile',
    name: 'react-native-quick-sqlite',
    definition:
      "This is the local SQLite database library the mobile app uses to store downloaded class, test, and scan data directly on the teacher's phone, so a teacher can scan and check student answers without an active internet connection and upload the results later.",
  },
  {
    group: 'mobile',
    name: 'OpenCV (Open Source Computer Vision Library)',
    definition:
      "This is the image-processing library, used from the app's native Kotlin code, that detects the printed page markers on a scanned answer sheet, corrects the photo's perspective and lighting, and determines whether each answer bubble is shaded in.",
  },
  {
    group: 'mobile',
    name: 'ZXing (Zebra Crossing)',
    definition:
      'This is the barcode/QR-code library the app uses, alongside OpenCV, to decode the QR code printed on each answer sheet, which identifies the exact student, test, and page being scanned.',
  },
  {
    group: 'mobile',
    name: 'Hermes',
    definition:
      "This is the JavaScript engine React Native uses to run the app's compiled TypeScript/JavaScript code on the Android device, chosen for its faster startup time on mobile hardware.",
  },
  {
    group: 'mobile',
    name: 'Android Keystore',
    definition:
      "This is the Android operating system's secure hardware-backed storage, used through a custom native module to keep a signed-in teacher's session token encrypted on the device instead of in plain, readable storage.",
  },
  {
    group: 'mobile',
    name: 'lucide-react-native',
    definition:
      "This is the icon library the researchers used to render the app's interface icons, such as the camera, checkmarks, search, and warning banners, consistently across every screen.",
  },
  {
    group: 'mobile',
    name: 'react-native-svg',
    definition:
      "This is the vector-graphics library that renders lucide-react-native's icons and any other scalable graphics the app needs.",
  },
  {
    group: 'mobile',
    name: 'react-native-safe-area-context',
    definition:
      "This is the library the researchers used to keep the app's buttons and text clear of a phone's notch, status bar, and rounded screen corners.",
  },
  {
    group: 'mobile',
    name: 'sha.js',
    definition:
      'This is the hashing library the app uses to compute SHA-256 hashes of downloaded class and test data, producing a stable identifier for each offline snapshot and detecting whether a payload changed since it was last downloaded.',
  },
  {
    group: 'mobile',
    name: 'Metro',
    definition:
      "This is React Native's JavaScript bundler, which compiles and serves the app's TypeScript/JavaScript source code to the physical Android device during development.",
  },
  {
    group: 'mobile',
    name: 'Jest',
    definition:
      "This is the testing framework the researchers used to write and run the mobile app's automated tests, covering its sync logic, local database repositories, and backend-contract parsing.",
  },
  {
    group: 'mobile',
    name: 'ESLint',
    definition:
      "This is the static-analysis tool used to catch problematic JavaScript/TypeScript patterns in the mobile app's source code before they are committed.",
  },
  {
    group: 'mobile',
    name: 'Android Studio / Gradle',
    definition:
      "This is the native Android build toolchain the researchers used to compile the app's Kotlin native modules, manage its Android dependencies such as OpenCV and ZXing, and package the app for installation on a physical device.",
  },
  {
    group: 'mobile',
    name: 'Android Debug Bridge (ADB)',
    definition:
      "This is the command-line tool the researchers used to install and run the app on a physical Android phone, forward the phone's network requests to the backend server running on the development computer, and inspect on-device logs while diagnosing issues.",
  },

  // Deployment (NEW group, not in Chapter III yet)
  {
    group: 'deployment',
    name: 'Render',
    definition:
      'This is the cloud hosting platform used to run the deployed Spring Boot backend and to publish the web dashboard as a static site, so teachers and the principal can reach the system online.',
  },
  {
    group: 'deployment',
    name: 'Docker',
    definition:
      'This is the container tool used to package the backend and everything it needs to run into one image, which Render builds and starts in the cloud.',
  },
  {
    group: 'deployment',
    name: 'TiDB Cloud',
    definition:
      "This is the MySQL-compatible cloud database service used to store the deployed system's data online, so the cloud backend does not depend on the researchers' own computers.",
  },

  // Development tools
  {
    group: 'tools',
    name: 'Visual Studio Code (VS Code)',
    definition:
      "This is the code editor the researchers used to write, debug, and manage all of the backend's Java source code, SQL scripts, and configuration files.",
  },
  {
    group: 'tools',
    name: 'Git and GitHub',
    definition:
      "This is the version-control system the researchers used to track changes to the mobile app's source code and coordinate work between the mobile, backend, and web components of the system.",
  },
]
