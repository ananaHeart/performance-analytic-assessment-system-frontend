# A Mobile and Web Performance Analytic Assessment System — Demo Checklist

## System Purpose

This system supports paper-based assessment checking through a teacher mobile app, offline SQLite storage, synchronization, and web analytics. The teacher creates the assessment setup in the web dashboard, downloads it to the mobile app, checks physical papers offline, uploads the checked results, and reviews performance analytics on the web dashboard.

## Demo Flow

### A. Web: Create Assessment

- Select the assigned class.
- Create the assessment details.
- Add an assessment section or test part.
- Add the answer key.
- Add the competency tag.

### B. Mobile: Download Assigned Data

- Open Profile / Sync Center.
- Tap Download Assigned Data.
- Confirm that classes, students, tests, test parts, and competencies are downloaded.

### C. Mobile: Check Student

- Select the class.
- Select the test.
- Search for or select the student.
- Confirm that all item buttons default to correct.
- Tap only the wrong answers.
- Confirm that the score updates.
- Tap Save Student.

### D. Mobile: Upload Current Test

- Upload only the selected test.
- Confirm upload success.
- Confirm that unchecked students are not uploaded.

### E. Web: View Analytics

- Open Analytics.
- Select the assessment.
- Show item analysis.
- Show least mastered skills.
- Show affected students if available.

### F. Mobile: Restore Uploaded Results

- Reset Local DB.
- Download Assigned Data again.
- Confirm that uploaded checked results are restored as synced.

## Short Defense Explanation

The teacher creates one complete paper-based assessment on the web. The assessment may contain multiple sections or test parts, such as Multiple Choice, Identification, and Enumeration. Each section has its own answer key, points per item, and competency tag. The mobile app downloads this setup for offline checking. The teacher then taps only wrong answers while checking physical papers. After upload, the backend uses the item-level results to generate item analysis, least mastered skills, and performance analytics. If the mobile data is cleared, the uploaded results can be restored through Download Sync.

## Important Notes

- The mobile app is not an online exam app.
- Students do not answer through the mobile app.
- The teacher uses the mobile app while checking physical papers.
- Test means the whole assessment.
- Test parts mean sections of that same assessment.
- Upload Current Test must remain selected-test scoped.
- Final analytics belongs to the web dashboard.
- Mobile analytics, if shown, is preliminary local data only.
