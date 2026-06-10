# Add Training form — confirmed fields (2026-06-10)

Corrects an earlier note: the form **does** have an expiry field (it sits below
the fold; the first selector capture stopped short of it). Good news — we enter
our own expiry per record and don't depend on course config.

## Full field list (the "Add training history details" panel)

- **Add training to *** (`#ddlDistributeTo`) — dropdown:
  *Please select / All employees in the company / Site / Employee group /
  Department or team / **Employee***. → choose **Employee**, then a second
  control appears to pick the specific person.
- **Course *** (`#SelectedCourse`) — autocomplete: type then select.
- Course code (`#CourseCode`) — optional, skip.
- CPD Minutes (`#CPDMinutes`) — optional, skip.
- **Start date *** (`#add-training-bulk-mode_AeDatetimePicker_1_ae-input_3`)
- **Completed date** (`#add-training-bulk-mode_AeDatetimePicker_2_ae-input_3`)
- **Expiry date** (datepicker — selector to confirm, likely
  `#add-training-bulk-mode_AeDatetimePicker_3_ae-input_3`)
- Course grade / Provider / Description / Certificates — optional, skip.
- **Add** (submit) `#add-training-bulk-mode_AeButton_1_aeButton_1` · Close.

## Per-record mapping (migration)

| Form field | Our data |
|---|---|
| Add training to | "Employee" → then pick `full_name` |
| Course | `training_course` (autocomplete) |
| Start date * | `completed_date` (we only hold completion; use it for both) |
| Completed date | `completed_date` |
| Expiry date | `expiry_date` (blank for the 107 no-expiry records) |

Start date is required and we have no separate "started" date for historical
training, so Start = Completed = our completion date. Expiry comes straight from
our master, so course-interval config in Atlas is **not** a dependency.

## Still to confirm on the first pilot record (3 selectors)

- The **employee picker** that appears after choosing "Employee" (and how to
  select by name).
- The **course autocomplete option** element.
- The **expiry date** input id (confirm the `_3_` guess) and the **success**
  confirmation after Add.
