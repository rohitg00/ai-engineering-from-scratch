# Evidence: cheatsheets/vlm-architectures.md

Abbreviations: V25 = phases/04-computer-vision/25-vision-language-models, M03 = phases/12-multimodal-ai/03-blip2-qformer-bridge, M04 = phases/12-multimodal-ai/04-flamingo-gated-cross-attention, M05 = phases/12-multimodal-ai/05-llava-visual-instruction-tuning, M07 = phases/12-multimodal-ai/07-open-weight-vlm-recipes, C60 = phases/19-capstone-projects/60-projection-layer-modality-align, C61 = phases/19-capstone-projects/61-cross-attention-fusion. d = docs/en.md, c = code/main.py.

## The ViT-MLP-LLM pattern (architecture, 7 nodes, 6 edges)
- Image H x W x 3: V25/d:31
- Vision encoder CLIP-L, SigLIP, DINOv3: V25/d:31, 47
- Projector 2-4 layer MLP or Q-former: V25/d:33, 48
- Text prompt, LLM tokenizer, text tokens (M, d_llm): V25/d:35-36
- Interleave or concat, image tokens in LLM space: V25/d:34, 37
- Decoder LLM generates the text answer: V25/d:39-40, 49
- Edge labels (N, d_vit) and (N, d_llm): V25/d:32, 34

## Bridge mechanisms (concepts, 8)
- MLP projector Linear, GELU, Linear, (N_patches, d_vit) to (N_patches, d_llm): V25/d:126-130, 136
- Q-Former 32 learnable queries, frozen ViT, 32 visual tokens: M03/d:29, 40
- Perceiver resampler K = 64 latents, fixed output count: M04/d:33, 38
- Gated cross-attention tanh(alpha) * cross + x, alpha init 0: M04/d:49, 53
- Cross-attention Q from one stream, K and V from another: C61/d:146
- Cosine alignment loss 1 - cos_sim, 0 to 2: C60/d:56
- DeepStack multi-level ViT features: V25/d:55, 272
- CMER definition: V25/d:95, 274

## Three training stages (flow, 5 steps)
1. Alignment, freeze ViT and LLM, projector on image-caption pairs: V25/d:61
2. LLaVA stage 1, 558k pairs, LM loss on caption, a few hours: M05/d:55, 57
3. Pre-training, unfreeze everything, 500M+ pairs: V25/d:62
4. Instruction tuning on (image, question, answer) triples: V25/d:63
5. LLaVA stage 2, projector and LLM, 158k turns: M05/d:61

## Tasks in code (task-table, 8)
- Projector(vit_dim=768, llm_dim=4096, hidden=4096): V25/d:124
- deepstack_features(per_layer_features): V25/c:40
- cross_modal_error_rate(image_emb, text_emb, text_confidence): V25/c:31, V25/d:188
- perceiver_resampler(patches, num_latents=8, num_blocks=2): M04/c:114
- gated_cross_attention_step(text_hidden, visual, alpha=0.0): M04/c:125
- interleaved_mask(seq), most recent preceding image: M04/c:89-91, 146
- build_llava_prompt(system, user, image_tokens=576): M05/c:116
- causal_mask(length): C61/c:45

## Merge image tokens into the text (annotated-code, 7 lines)
- vision_tokens = self.vit(image), shape comment: V25/d:153
- vision_embeds = self.projector(vision_tokens): V25/d:154
- text_embeds = self.llm.get_input_embeddings()(input_ids): V25/d:157
- out = text_embeds.clone(): V25/d:166
- for b in range(input_ids.size(0)): V25/d:168
- positions = (input_ids[b] == self.image_token_id).nonzero(as_tuple=True)[0]: V25/d:169
- out[b, positions] = vision_embeds[b], <image> placeholder: V25/d:174, 178

## Train only the projection (annotated-code, 9 lines)
- cfg = AlignConfig(), 768, 1024, 512, 200 steps: C60/c:49-56, 207
- encoder = VisionEncoder(encoder_cfg).eval(): C60/c:151
- freeze(encoder), requires_grad_(False): C60/c:124-126, 152
- projector = MLPProjector(...): C60/c:157
- with torch.no_grad(), _, cls = encoder(img), text_emb = text(ids): C60/c:171-173
- MockTextEmbedding frozen table: C60/c:73, 154-155
- image_emb = projector(cls): C60/c:175
- loss = cosine_alignment_loss(image_emb, text_emb): C60/c:176

## Bridge numbers (defaults, 7)
- Q-Former 32 queries, 188M params: M03/d:23
- Perceiver latents 64 after 6 blocks: M04/d:33, 38
- Gated block every M = 4, alpha init 0: M04/d:44, 53
- LLaVA 576 tokens, 24x24 grid: M03/d:73, MLP 1024 → 4096 → 4096: M05/d:37
- AnyRes 2880 tokens, 336x336 crops plus thumbnail: M05/d:89
- Token sweet spot 576-1024, 64 too few for OCR: M07/d:51
- Dynamic resolution min 256, max 1280 pixels per long side: M07/d:96

## Troubleshooting (troubleshooting, 6)
- ValueError on image tokens, pre-pad to the same count: V25/d:170-173
- 12% of crawled pairs not grounded: V25/d:90, CMER and route to human review: V25/d:98
- Spatial reasoning 50-60%, use keypoint/pose, depth or detection: V25/d:106
- Fine-tune degraded text, gate too wide too fast: M04/d:125, alpha init 0: M04/d:53, gate schedule: M04/d:150
- Weak OCR, 64 tokens too few, 576-1024 tokens: M07/d:51, AnyRes on OCR: M07/d:71
- LLaVA context fills faster, 576 tokens: M03/d:73, Q-Former at 32 tokens: M03/d:75, M07/d:53

## Abbreviations (glossary, 6)
- VLM bolts an image encoder to a full language model: V25/d:21
- ITC: M03/d:47, 129
- ITM: M03/d:48, 130
- ITG: M03/d:49, 131
- CMER: V25/d:92, 274
- AnyRes: M05/d:165

## Questions (qa, 6)
- Q-Former for token budget, MLP for quality per token: M03/d:75
- BLIP-2 single-image VQA on a budget, Flamingo for few-shot and multi-image: M04/d:109
- Alpha 0 means step 0 equals the pretrained LLM: M04/d:58
- No cross-attention mask, image fully observed: C61/d:59
- Two layers, GELU gives one non-linear bend, linear only rotates and rescales: C60/d:44
- Visual-token count ~60%, encoder ~20%, connector ~5%: M07/d:81-83

## Default open-VLM recipe (tips, 6)
- SigLIP 2 SO400m/14, DINOv2 ViT-g/14 for segmentation/grounding: M07/d:92
- 2-layer MLP on patch tokens, skip Q-Former unless token-constrained: M07/d:93
- 7B for cost, 70B for quality: M07/d:94, LLM size sets the ceiling: M07/d:55
- PixMo + ShareGPT4V + Cauldron: M07/d:95, human captions beat distillation: M07/d:15, 61
- Stage 1 at 384 fixed, dynamic up to 1280 for OCR: M07/d:75, ramping: M07/d:71
- SigLIP over CLIP added 3+ points MMMU: M07/d:41
