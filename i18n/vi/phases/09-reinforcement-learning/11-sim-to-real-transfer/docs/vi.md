# Chuyển Sim-to-Real

> Một chính sách được đào tạo trong một máy mô phỏng mà thất bại trên phần cứng là một chính sách ghi nhớ máy mô phỏng.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 9 · 08 (PPO), Phase 2 · 10 (Bias/Variance)
**Time:** ~45 minutes

## Vấn đề

Trình luyện một robot thực sự là chậm, nguy hiểm và tốn kém. Một con đôi đạp phải mất hàng triệu tập tập để học cách đi bộ; một con đạp thực sự rơi xuống ngay cả khi phá vỡ phần cứng.

Nhưng máy mô phỏng sai. Các vòng đệm có độ chi phối nhiều hơn các mô hình MuJoCo. Các máy ảnh có độ biến dạng ống kính mà máy mô phỏng không bao gồm. Các động cơ có sự chậm trễ, phản ứng ngược và bão hòa mà 99% các mô hình sim bỏ qua. gió, bụi và ánh sáng biến đổi phá hoại một chính sách được đào tạo về rendering vô sinh.**reality gap** Sự khác biệt có hệ thống giữa phân phối sim và phân phối thực  là vấn đề trung tâm của RL được triển khai cho robot.

Bạn cần một chính sách có khả năng chuyển đổi phân phối sim-to-real. Ba cách tiếp cận lịch sử: ngẫu nhiên mô phỏng (ngẫu nhiên phân phối miền), điều chỉnh chính sách với một chút dữ liệu thực (ngh thích ứng / điều chỉnh tinh tế miền), hoặc xác định các tham số của hệ thống thực và phù hợp với chúng (chẩn đoán hệ thống). Năm 2026, công thức thống trị kết hợp cả ba với mô phỏng song song lớn (Isaac Sim, Isaac Lab, Mujoco MJX trên GPU).

## Khái niệm

![Three sim-to-real regimes: domain randomization, adaptation, system identification](../assets/sim-to-real.svg)

**Domain Randomization (DR).**Tobin và các đồng nghiệp. 2017, Peng et al. Năm 2018. Trong quá trình đào tạo, ngẫu nhiên tất cả các tham số sim có thể khác nhau trên robot thực: khối lượng, hệ số soá, tăng PD động cơ, tiếng ồn cảm biến, vị trí máy ảnh, ánh sáng, kết cấu, mô hình tiếp xúc. Chính sách học được một phân phối điều kiện về "những sim nó là trong ngày hôm nay" và tổng quát trên toàn phạm vi. Nếu robot thực sự nằm trong bao bì huấn luyện, chính sách sẽ hoạt động.

- **Upside:**Không cần dữ liệu thực sự. Một công thức, nhiều robot.
- **Downside:**Việc đào tạo vô tình tạo ra một chính sách "tối đa" nhưng quá thận trọng.

**System Identification (SI).**Nếu bạn có thể đo lường độ soá cánh tay trên robot thực, hãy kết nối nó vào bộ mô phỏng. Sau đó tập một chính sách dự đoán các giá trị đó.

- **Upside:**mục tiêu đào tạo chính xác, thấp tiếng ồn.
- **Downside:**lỗi mô hình còn lại không thể nhìn thấy đối với chính sách; các tác dụng nhỏ không được xác định (ví dụ, dây chuyền động cơ) vẫn phá vỡ triển khai.

**Domain Adaptation.**Trình luyện trong bộ Sim, điều chỉnh tinh tế với một lượng nhỏ dữ liệu thực.

- **Real2Sim2Real:**học một mô phỏng dư thừa $f(s, a, z) - f_{\text{sim}}(s, a)$sử dụng các bản triển khai thực, tập luyện trong bộ nhớ sim đã sửa chữa.
- **Observation adaptation:**đào tạo một chính sách lập bản đồ thực obs → sim-like obs thông qua một bộ trích dẫn tính năng học (ví dụ, GAN pixel-to-pixel).

**Privileged learning / teacher-student.**Miki et al. 2022 (ANYmal quadruped). Trén một * giáo viên * trong mô phỏng có quyền truy cập vào thông tin đặc quyền (trận lưỡng lự chân lý mặt đất, độ cao địa hình, IMU drift). Chưa một * học sinh * chỉ nhìn thấy quan sát cảm biến thực. Học sinh học được suy luận các tính năng đặc quyền từ lịch sử, mạnh mẽ qua các tham số vật lý.

**Massively parallel simulation.**20242026. Isaac Lab, Mujoco MJX, Brax tất cả chạy hàng ngàn robot song song trên một GPU duy nhất. PPO với 4.096 nhân vật song song thu thập nhiều năm kinh nghiệm trong vài giờ. "các khoảng cách thực tế" thu hẹp khi phân phối đào tạo mở rộng; DR trở nên gần như miễn phí khi mỗi trong số 4.096 envs có các tham số ngẫu nhiên khác nhau.

**The real-world 2026 recipe (quadruped walking example):**

1. Sim song song lớn với trọng lực ngẫu nhiên, độ chà, tăng động cơ, tải trọng.
2. Chính sách giáo viên được đào tạo với thông tin đặc quyền (kìa đồ địa hình, tốc độ cơ thể thực tế mặt đất).
3. Chính sách học sinh được thu hút từ giáo viên chỉ sử dụng proprioception (code bộ phận ghép chân).
4. Chuẩn bị quan sát tùy chọn thông qua mã tự động trên IMU thực.
5. Đưa ra, không chụp trên 10 môi trường, nếu không, hãy điều chỉnh thực tế bằng cách sử dụng PPO.

```figure
f3-reality-gap
```

## Hãy xây dựng nó

Mã bài học này là một minh họa nhỏ về sự ngẫu nhiên của miền trên một GridWorld với chuyển đổi * tiếng ồn *. Chúng tôi đào tạo một chính sách trải nghiệm xác suất trượt ngẫu nhiên trong "sim" và đánh giá trên "thực tế" với mức trượt mà nó chưa từng thấy trong quá trình đào tạo. Các hình dạng được vẽ trực tiếp đến chuyển đổi MuJoCo-to-hardware.

### Bước 1: Sim được tham số

```python
def step(state, action, slip):
    if rng.random() < slip:
        action = random_perpendicular(action)
    ...
```

`slip`trong robot thực sự nó có thể là trục trặc, khối lượng, tăng động lực bất cứ điều gì thay đổi giữa sim và thực.

### Bước 2: đào tạo với DR

Vào đầu mỗi tập, lấy mẫu `slip ~ Uniform[0.0, 0.4]`- Cụ thể, tập PPO/Q-learning/ bất cứ điều gì.

### Bước 3: đánh giá điểm không bắn trên các tờ rơi "thực"

Đánh giá`slip ∈ {0.0, 0.1, 0.2, 0.3, 0.5, 0.7}`. Bốn chương trình đầu tiên được hỗ trợ trong việc đào tạo;`0.5`và `0.7`Một chính sách được đào tạo DR nên ở gần như tối ưu bên trong hỗ trợ và suy giảm đẹp đẽ bên ngoài.

### Bước 4: so sánh với đào tạo hẹp

Căn nuôi một chính sách thứ hai với `slip = 0.0`Chỉ đánh giá trên cùng một`slip`Bạn sẽ thấy một sự sụt giảm thảm khốc ngay khi trượt thực > 0.

## Những bẫy

- **Too much randomization.**Đào tàu lên`slip ∈ [0, 0.9]`và chính sách của bạn rất không chấp nhận rủi ro mà nó không bao giờ cố gắng theo con đường tối ưu.
- **Too little randomization.**Căn luyện trên một mảnh mỏng và chính sách không thể tổng quát hóa. Sử dụng chương trình giảng dạy thích ứng (Tự động Tự nhiên phân phối miền) mở rộng phân phối khi chính sách cải thiện.
- **Misidentified parameter space.**Định dạng thứ sai (màu sắc của máy ảnh khi khoảng cách thực sự là chậm trễ động lực) và DR không giúp.
- **Privileged info leakage.**Một giáo viên sử dụng tình trạng toàn cầu để hành động, không chỉ quan sát, có thể tạo ra một học sinh không thể bắt kịp.
- **Sim-to-sim transfer failure.**Nếu chính sách của bạn không vững chắc với một biến thể sim khó khăn hơn, nó cũng sẽ không vững chắc với thế giới thực.
- **No real-world safety envelope.**Một chính sách hoạt động trong sim và "sống thực tế" mà không có một tấm khiên an toàn cấp thấp vẫn có thể phá vỡ phần cứng.

## Sử dụng nó

Bộ sưu tập sim-to-real năm 2026:

| Domain | Stack |
|--------|-------|
| Legged locomotion (ANYmal, Spot, humanoid) | Isaac Lab + DR + privileged teacher / student |
| Manipulation (dexterous hands, pick-and-place) | Isaac Lab + DR + DR-GAN for vision |
| Autonomous driving | CARLA / NVIDIA DRIVE Sim + DR + real fine-tune |
| Drone racing | RotorS / Flightmare + DR + online adaptation |
| Finger/in-hand manipulation | OpenAI Dactyl (DR at unprecedented scale) |
| Industrial arms | MuJoCo-Warp + SI + small real fine-tune |

Để kiểm soát ở mọi quy mô, dòng công việc là nhất quán: phù hợp với bộ sim tốt nhất có thể, ngẫu nhiên những gì bạn không thể phù hợp, đào tạo các chính sách khổng lồ, chưng cất, triển khai với một tấm khiên an toàn.

## Chuyển nó

Cứ như `outputs/skill-sim2real-planner.md`- Có thể là:

```markdown
---
name: sim2real-planner
description: Plan a sim-to-real transfer pipeline for a given robot + task, covering DR, SI, and safety.
version: 1.0.0
phase: 9
lesson: 11
tags: [rl, sim2real, robotics, domain-randomization]
---

Given a robot platform, a task, and access to real hardware time, output:

1. Reality gap inventory. Suspected sources ranked by expected impact (contact, sensing, actuation delay, vision).
2. DR parameters. Exact list, ranges, distribution. Justify each range against real measurements.
3. SI steps. Which parameters to measure; measurement method.
4. Teacher/student split. What privileged info the teacher uses; what obs the student uses.
5. Safety envelope. Low-level limits, emergency stops, backup controller.

Refuse to deploy without (a) a zero-shot sim-variant test, (b) a safety shield, (c) a rollback plan. Flag any DR range wider than 3× measured real variability as likely over-randomized.
```

## Các bài tập

1. **Easy.**Trình luyện một đại lý học Q trên GridWorld (slip=0.0).$\text{slip} \in \lbrace 0.0, 0.1, 0.3, 0.5 \rbrace$- Đưa lại với trượt.
2. **Medium.**Trình luyện một nhân viên học tập DR Q lấy mẫu `slip ~ Uniform[0, 0.3]`- Đánh giá cùng một loại. DR mua bao nhiêu ở slip=0.5 (không phân phối)?
3. **Hard.**Thực hiện một chương trình giảng dạy: bắt đầu với slip=0.0, mở rộng phạm vi DR mỗi khi chính sách đạt 90% tối ưu. đo lường tổng bước môi trường để đạt slip=0.3 zero shot so với một đường cơ sở DR cố định.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Reality gap | "Sim-to-real difference" | Distribution shift between training and deployment physics/sensing. |
| Domain randomization (DR) | "Train across random sims" | Randomize sim parameters during training so policy generalizes. |
| System identification (SI) | "Measure real and fit sim" | Estimate real physical parameters; set sim to match. |
| Domain adaptation | "Fine-tune on real data" | Small real-world fine-tune after sim training; may adapt obs or dynamics. |
| Privileged info | "Ground truth for teacher" | Information only the sim has; student must infer it from obs history. |
| Teacher/student | "Distill privileged -> observable" | Teacher trained with shortcuts; student learns to mimic without them. |
| ADR | "Automatic Domain Randomization" | Curriculum that widens DR ranges as the policy improves. |
| Real2Sim | "Close the gap with real data" | Learn a residual to make the sim mimic real rollouts. |

## Đọc thêm

- [Tobin et al. (2017). Domain Randomization for Transferring Deep Neural Networks from Simulation to the Real World](https://arxiv.org/abs/1703.06907) giấy DR ban đầu (trầm nhìn cho robot).
- [Peng et al. (2018). Sim-to-Real Transfer of Robotic Control with Dynamics Randomization](https://arxiv.org/abs/1710.06537) DR cho động lực, động cơ bốn lần.
- [OpenAI et al. (2019). Solving Rubik's Cube with a Robot Hand](https://arxiv.org/abs/1910.07113) Dactyl, ADR ở quy mô.
- [Miki et al. (2022). Learning robust perceptive locomotion for quadrupedal robots in the wild](https://www.science.org/doi/10.1126/scirobotics.abk2822) giáo viên- học sinh cho ANYmal.
- [Makoviychuk et al. (2021). Isaac Gym: High Performance GPU Based Physics Simulation for Robot Learning](https://arxiv.org/abs/2108.10470) Sim song song lớn thúc đẩy việc triển khai 20252026
- [Akkaya et al. (2019). Automatic Domain Randomization](https://arxiv.org/abs/1910.07113) Phương pháp chương trình học ADR.
- [Sutton & Barto (2018). Ch. 8 — Planning and Learning with Tabular Methods](http://incompleteideas.net/book/RLbook2020.pdf) khung Dyna ( Sử dụng mô hình để lập kế hoạch + triển khai) hỗ trợ đường ống sim-to-real hiện đại.
- [Zhao, Queralta & Westerlund (2020). Sim-to-Real Transfer in Deep Reinforcement Learning for Robotics: a Survey](https://arxiv.org/abs/2009.13303) phân loại các phương pháp sim-to-real với kết quả tham chiếu.
