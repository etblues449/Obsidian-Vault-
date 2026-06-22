# Prompt 3 — Reconcile against Atlas (the core loop)

```
Now reconcile the attendance records against what's currently in the Atlas portal.

1. Make sure data/sheet_records.csv exists (from prompt 2) and that the latest
   Atlas export is at data/TrainingRecordReport.xlsx (Atlas > Reports > Training
   Record Report > export to Excel).
2. Run:
     python handover/scripts/reconcile.py \
       --sheets handover/data/sheet_records.csv \
       --atlas  handover/data/TrainingRecordReport.xlsx \
       --master handover/data/Atlas_Training_Master_VERIFIED.xlsx \
       --outdir handover/output
3. Open handover/output/summary.txt and tell me:
     - how many staff need CREATING in Atlas, and how many of those the prior
       audit had MISSED (priority = MISSED-recover-from-scratch),
     - how many training records are ready to ADD.
4. Show me staff_to_create_in_atlas.csv sorted with the MISSED people first.

Do not enter anything into Atlas yet. I will review the create-list first.
```

## The loop (repeat until full accuracy)
1. I review & create the `staff_to_create` people in Atlas (new staff records).
2. I re-export the Atlas Training Record Report → overwrite `data/TrainingRecordReport.xlsx`.
3. You re-run the command above.
4. When **"staff to CREATE" = 0**, every person on every sheet now exists in
   Atlas → we have full accuracy on people, and `records_to_add.csv` is the
   complete set of training rows to enter.
