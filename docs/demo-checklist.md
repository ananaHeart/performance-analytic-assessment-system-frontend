# Performance Analytics Assessment System - Demo Checklist

Document created: July 9, 2026  
Last reviewed: July 13, 2026  
Last updated: August 1, 2026  
Coverage period: June 2026 to August 2026

## System Purpose

The system supports paper-based assessment checking. The teacher creates the assessment setup in the web dashboard, downloads assigned data to the mobile app, checks physical papers offline, uploads checked results, and reviews analytics in the web dashboard.

The mobile app is used by the teacher. Students do not answer through the mobile app.

## Demo Documentation Timeline

- July 9, 2026: Initial demo-related documentation existed in the frontend repository history.
- July 12, 2026: Demo checklist was refreshed for panel presentation.
- July 12, 2026: Demo flow was updated to include Student Profile Skill Mastery, Teacher Intervention, Render backend configuration, and selected assessment student score export.
- July 13, 2026: Demo flow was updated to include grade-level dependent section assignment and Gantt chart documentation.
- August 1, 2026: Demo flow was updated to include the cleaned frontend UI, compact SF1 modal, Recharts analytics charts, sync-time display alignment, and whole-assessment student score table.

## Demo Prerequisites

- Backend is running locally or deployed on Render.
- Web dashboard has the correct `VITE_API_URL`.
- Teacher account is approved by the principal.
- Teacher has an assigned class, subject, section, grade level, and academic year.
- Students are available through manual entry or SF1 import.
- Mobile app has downloaded assigned data before checking.

## A. Principal Web Flow

1. Log in as principal.
2. Open Teacher Approval.
3. Approve a registered teacher account.
4. Open Class Assignment.
5. Select teacher.
6. Select subject.
7. Select grade level.
8. Select one of the available backend-returned sections for that grade level.
9. Assign the teacher to the class.
10. If no sections exist for the selected grade level, confirm the UI shows `No available sections for this grade level.`
11. Open Class Records / Student Records.
12. Add students manually or use SF1 import preview and confirm.

Expected result:

- Teacher is active.
- Class assignment exists.
- Students are connected to the correct class context.
- Teacher assignment uses imported available sections instead of hardcoded section values.

## B. Teacher Web Flow - Assessment Setup

1. Log in as teacher.
2. Open the assigned class.
3. Open Assessment.
4. Create an assessment.
5. Add assessment parts.
6. Add answer keys.
7. Assign competency or branch skill mappings.
8. Save the assessment setup.

Expected result:

- The assessment appears in the teacher class record.
- Each part has item count, points per item, answer key, and competency mapping.

## C. Mobile Flow - Download Assigned Data

1. Open the mobile app.
2. Open Profile / Sync Center.
3. Tap Download Assigned Data.
4. Confirm that these records are downloaded:
   - classes
   - students
   - tests / assessments
   - test parts
   - answer keys
   - competencies

Expected result:

- The teacher can select the assigned class and assessment offline.

## D. Mobile Flow - Check Student Paper

1. Select the class.
2. Select the assessment.
3. Search or select the student.
4. Confirm all item buttons default to correct.
5. Tap only the wrong answers.
6. Confirm the score updates.
7. Tap Save Student.

Expected result:

- Student score is saved locally.
- The score is based on the selected assessment and selected part/item setup.

## E. Mobile Flow - Upload Current Test

1. Open sync/upload flow.
2. Choose Upload Current Test.
3. Upload only the selected assessment.
4. Confirm upload success.

Expected result:

- Checked student results are sent to the backend.
- Unchecked students are not uploaded as checked results.

## F. Teacher Web Flow - Analytics

1. Return to the web dashboard.
2. Open the teacher's class.
3. Open Analytics.
4. Select the subject and assessment.
5. Review:
   - Performance Summary
   - Least Mastered Skills
   - Assessment Score Details
   - Student Results
   - Recommended Intervention

Expected result:

- Analytics reflects uploaded mobile checking results.
- Score details reflect the selected assessment.
- Student scores show whole-assessment totals for the selected quiz/test.
- Teacher intervention is shown as a teacher-facing recommendation, not a student message.
- Highest and lowest student cards show actual score values instead of percentage-only values.

## G. Teacher Web Flow - Student Profile

1. Open the Students tab.
2. Select a student.
3. Open the student profile.
4. Review Skill Mastery.

Expected result:

- Skill Mastery shows all assessed competencies for the selected student in the selected class.
- The list includes mastered, developing, and needs-support skills.
- The student avatar color reflects gender:
  - pink for female
  - blue for male
  - gray for unknown or missing gender

## H. Teacher Web Flow - Export Student Scores

1. Open Analytics.
2. Select the assessment.
3. Click Export Report.
4. Download the Excel file.

Expected result:

- The export uses `GET /api/export/student-scores/{testId}`.
- The file contains actual student score rows for the selected assessment.
- The file is not LMS export and not item analysis export.

## I. Mobile Flow - Restore Uploaded Results

1. Reset or clear local mobile data, if needed for demo.
2. Download assigned data again.
3. Confirm uploaded checked results are restored as synced records.

Expected result:

- Previously uploaded checked results can be restored from the backend.

## Short Defense Explanation

The system is designed for paper-based assessments. The teacher creates the assessment structure on the web dashboard, including parts, answer keys, and competency mappings. The mobile app downloads this setup for offline checking. During checking, the teacher taps only wrong answers while reviewing physical papers. After upload, the backend stores checked results and computes analytics. The web dashboard displays student scores, skill mastery, least mastered skills, and teacher-facing intervention recommendations. Export reports allow teachers to download selected assessment student scores for documentation and review.

## Important Notes

- The mobile app is not an online exam app.
- Students do not answer through the mobile app.
- The teacher uses the mobile app while checking physical papers.
- Test or assessment means the whole assessment.
- Test parts mean sections of the same assessment.
- Upload Current Test must remain selected-assessment scoped.
- Final analytics belongs to the web dashboard.
- Mobile analytics, if shown, is preliminary local data only.
- Teacher intervention recommendations are for teacher guidance, not direct student messaging.
