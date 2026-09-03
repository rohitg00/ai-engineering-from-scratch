"""Deterministic tests for the semantic-segmentation U-Net lesson."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

import numpy as np
import torch


sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from main import (
    SegDataset,
    UNet,
    combined_loss,
    dice_loss,
    intersection_union_per_class,
    iou_from_counts,
    iou_per_class,
    synthetic_segmentation,
)


class SemanticSegmentationTests(unittest.TestCase):
    def setUp(self) -> None:
        torch.manual_seed(0)

    def test_synthetic_data_is_seeded_and_contains_valid_shapes(self) -> None:
        first_images, first_masks = synthetic_segmentation(6, size=32, seed=17)
        second_images, second_masks = synthetic_segmentation(6, size=32, seed=17)

        np.testing.assert_array_equal(first_images, second_images)
        np.testing.assert_array_equal(first_masks, second_masks)
        self.assertEqual(first_images.shape, (6, 32, 32, 3))
        self.assertEqual(first_masks.shape, (6, 32, 32))
        self.assertEqual(first_images.dtype, np.float32)
        self.assertEqual(first_masks.dtype, np.int64)
        self.assertGreaterEqual(float(first_images.min()), 0.0)
        self.assertLessEqual(float(first_images.max()), 1.0)
        self.assertTrue(set(np.unique(first_masks)).issubset({0, 1, 2}))

    def test_synthetic_data_can_place_both_shape_classes_in_one_scene(self) -> None:
        images, masks = synthetic_segmentation(24, size=32, seed=5)

        multi_class_scenes = [
            index for index, mask in enumerate(masks) if set(np.unique(mask)) == {0, 1, 2}
        ]
        self.assertTrue(multi_class_scenes)

        background_colours = images[:, 0, 0]
        self.assertGreater(np.unique(background_colours, axis=0).shape[0], 1)

    def test_dataset_converts_channel_order_and_dtypes(self) -> None:
        images, masks = synthetic_segmentation(2, size=32, seed=3)
        dataset = SegDataset(images, masks)

        image, mask = dataset[0]

        self.assertEqual(len(dataset), 2)
        self.assertEqual(tuple(image.shape), (3, 32, 32))
        self.assertEqual(tuple(mask.shape), (32, 32))
        self.assertEqual(image.dtype, torch.float32)
        self.assertEqual(mask.dtype, torch.int64)
        np.testing.assert_array_equal(image.permute(1, 2, 0).numpy(), images[0])
        np.testing.assert_array_equal(mask.numpy(), masks[0])

    def test_unet_preserves_odd_spatial_dimensions(self) -> None:
        model = UNet(in_channels=3, num_classes=4, base=2).eval()
        inputs = torch.randn(2, 3, 33, 35)

        with torch.no_grad():
            logits = model(inputs)

        self.assertEqual(tuple(logits.shape), (2, 4, 33, 35))

    def test_dice_loss_rewards_a_perfect_prediction(self) -> None:
        targets = torch.tensor([[[0, 1], [2, 1]]])
        perfect_logits = torch.full((1, 3, 2, 2), -20.0)
        perfect_logits.scatter_(1, targets.unsqueeze(1), 20.0)
        uniform_logits = torch.zeros_like(perfect_logits)

        perfect = dice_loss(perfect_logits, targets, num_classes=3)
        uniform = dice_loss(uniform_logits, targets, num_classes=3)

        self.assertLess(perfect.item(), 1e-6)
        self.assertGreater(uniform.item(), perfect.item())

    def test_combined_loss_reports_components_and_backpropagates(self) -> None:
        logits = torch.randn(2, 3, 4, 4, requires_grad=True)
        targets = torch.randint(0, 3, (2, 4, 4))

        loss, components = combined_loss(logits, targets, num_classes=3, lam=0.5)
        loss.backward()

        self.assertAlmostEqual(
            loss.item(), components["ce"] + 0.5 * components["dice"], places=6
        )
        self.assertIsNotNone(logits.grad)
        self.assertTrue(torch.isfinite(logits.grad).all())
        self.assertGreater(logits.grad.abs().sum().item(), 0.0)

    def test_iou_per_class_handles_exact_partial_and_absent_classes(self) -> None:
        predictions = torch.tensor([[[0, 0], [1, 1]]])
        targets = torch.tensor([[[0, 1], [1, 1]]])
        logits = torch.full((1, 3, 2, 2), -10.0)
        logits.scatter_(1, predictions.unsqueeze(1), 10.0)

        ious = iou_per_class(logits, targets, num_classes=3)

        self.assertAlmostEqual(ious[0].item(), 0.5)
        self.assertAlmostEqual(ious[1].item(), 2.0 / 3.0)
        self.assertTrue(torch.isnan(ious[2]))

    def test_dataset_iou_aggregates_counts_instead_of_averaging_batches(self) -> None:
        first_predictions = torch.tensor([[[1]]])
        first_targets = torch.tensor([[[1]]])
        second_predictions = torch.tensor([[[0, 0, 0]]])
        second_targets = torch.tensor([[[1, 1, 1]]])
        intersections = torch.zeros(2)
        unions = torch.zeros(2)

        for predictions, targets in (
            (first_predictions, first_targets),
            (second_predictions, second_targets),
        ):
            logits = torch.full((1, 2, *predictions.shape[-2:]), -10.0)
            logits.scatter_(1, predictions.unsqueeze(1), 10.0)
            batch_intersections, batch_unions = intersection_union_per_class(
                logits, targets, num_classes=2
            )
            intersections += batch_intersections
            unions += batch_unions

        dataset_ious = iou_from_counts(intersections, unions)

        self.assertAlmostEqual(dataset_ious[1].item(), 0.25)
        self.assertNotAlmostEqual(dataset_ious[1].item(), (1.0 + 0.0) / 2.0)


if __name__ == "__main__":
    unittest.main()
