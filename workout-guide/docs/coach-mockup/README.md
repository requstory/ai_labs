# FitSplit Coach mockup

Interactive iPhone mockup and build plan for a personal 24-week training tracker, for review before the app is built.

- `template.html`: the mockup source. It includes the plan generator, all screens and the build plan.
- `build.py`: inlines the FitSplit exercise frames the mockup uses and writes a self-contained page.

```sh
python3 build.py template.html ../../packages/workout-guide/assets coach-mockup.html
```

The built page (about 2.5 MB) is not committed. Personal start numbers are hard-coded here as mockup examples only. The real app will ask for them on first launch and keep them on the device.
