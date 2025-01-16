router.get("/:id", dreamController.getDreamById);
router.get("/date/:date", dreamController.getDreamsByDate);
router.put("/:id", dreamController.updateDream);
router.delete("/:id", dreamController.deleteDream);
