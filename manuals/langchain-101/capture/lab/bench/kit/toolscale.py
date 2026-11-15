import argparse
import hashlib
import json
import random
import time
import uuid

from langchain_core.tools import StructuredTool
from pydantic import create_model

from env import BENCH
from models import make_model
from run import load_tasks, run_one, uptime

CORE = ["get_item_info", "get_exchange_rate", "get_shipping_rate", "convert_units", "calculator", "submit_answer"]

DISTRACTORS = [
    ("get_item_rating", "Get the average customer rating (1-5 stars) for a catalog item.", ["item"]),
    ("get_item_stock", "Get the number of units in stock for a catalog item at the main warehouse.", ["item"]),
    ("get_item_dimensions", "Get the packed dimensions (length, width, height in cm) of a catalog item.", ["item"]),
    ("get_item_price_history", "Get the list of past prices of a catalog item over the last 12 months.", ["item"]),
    ("get_item_reviews", "Get the three most recent customer reviews for a catalog item.", ["item"]),
    ("get_item_warranty", "Get the warranty period in months for a catalog item.", ["item"]),
    ("get_item_supplier", "Get the supplier name and country for a catalog item.", ["item"]),
    ("get_item_category", "Get the catalog category of an item.", ["item"]),
    ("search_catalog", "Search the catalog for items whose name matches a keyword.", ["keyword"]),
    ("get_similar_items", "Get up to five items similar to a given catalog item.", ["item"]),
    ("get_tax_rate", "Get the sales tax rate in percent for a country code.", ["country"]),
    ("get_customs_duty", "Get the customs duty rate in percent for importing a product category into a country.", ["category", "country"]),
    ("get_exchange_rate_history", "Get the daily exchange rate between two currencies for the last 30 days.", ["from_currency", "to_currency"]),
    ("get_currency_symbol", "Get the printed symbol for an ISO currency code.", ["currency"]),
    ("get_inflation_rate", "Get the annual inflation rate in percent for a country code.", ["country"]),
    ("get_delivery_estimate", "Get the estimated delivery time in days for a carrier and zone.", ["carrier", "zone"]),
    ("track_shipment", "Get the current status of a shipment by tracking number.", ["tracking_number"]),
    ("get_carrier_contact", "Get the customer service phone number and email of a carrier.", ["carrier"]),
    ("get_flat_shipping_fee", "Get the flat handling fee a carrier charges per parcel, regardless of weight.", ["carrier"]),
    ("get_insurance_rate", "Get the shipping insurance rate in percent of declared value for a carrier.", ["carrier"]),
    ("get_pickup_slots", "List the available parcel pickup time slots for a carrier tomorrow.", ["carrier"]),
    ("get_packaging_cost", "Get the cost of packaging material for a parcel size (small, medium, large).", ["size"]),
    ("get_warehouse_location", "Get the address of the warehouse that stocks an item.", ["item"]),
    ("get_return_policy", "Get the return policy text for a product category.", ["category"]),
    ("convert_temperature", "Convert a temperature between celsius, fahrenheit and kelvin.", ["value", "from_unit", "to_unit"]),
    ("convert_timezone", "Convert a time (HH:MM) from one time zone to another.", ["time", "from_zone", "to_zone"]),
    ("convert_currency_amount_legacy", "Deprecated. Converts an amount between currencies using last year's fixed rates. Do not use for current prices.", ["amount", "from_currency", "to_currency"]),
    ("round_number", "Round a number to a given number of decimal places.", ["value", "decimals"]),
    ("percentage_of", "Compute what percentage one number is of another.", ["part", "whole"]),
    ("get_weather", "Get the current weather for a city.", ["city"]),
    ("get_weather_forecast", "Get a three-day weather forecast for a city.", ["city"]),
    ("get_store_hours", "Get the opening hours of a retail store by city.", ["city"]),
    ("get_coupon_codes", "List currently valid coupon codes for a product category.", ["category"]),
    ("apply_discount", "Apply a discount percentage to a price and return the reduced price.", ["price", "percent"]),
    ("get_loyalty_points", "Get the loyalty points balance of a customer id.", ["customer_id"]),
    ("get_customer_profile", "Get the profile (name, city, tier) of a customer id.", ["customer_id"]),
    ("get_order_status", "Get the status of an order by order id.", ["order_id"]),
    ("list_recent_orders", "List the five most recent orders of a customer id.", ["customer_id"]),
    ("create_support_ticket", "Open a customer support ticket with a subject.", ["subject"]),
    ("get_support_ticket", "Get the status of a support ticket by id.", ["ticket_id"]),
    ("send_email", "Send an email to an address with a subject and body.", ["to", "subject", "body"]),
    ("schedule_meeting", "Schedule a meeting on a date (YYYY-MM-DD) with a title.", ["date", "title"]),
    ("list_calendar_events", "List calendar events on a date (YYYY-MM-DD).", ["date"]),
    ("get_public_holidays", "List public holidays for a country code and year.", ["country", "year"]),
    ("get_city_distance", "Get the road distance in km between two cities.", ["city_a", "city_b"]),
    ("get_city_population", "Get the population of a city.", ["city"]),
    ("get_fuel_price", "Get the current fuel price per litre in a country.", ["country"]),
    ("get_train_times", "Get the next three train departures between two stations.", ["from_station", "to_station"]),
    ("get_flight_status", "Get the status of a flight by flight number.", ["flight_number"]),
    ("get_hotel_rates", "Get the nightly hotel rate range in a city.", ["city"]),
    ("translate_text", "Translate a short text into a target language code.", ["text", "language"]),
    ("summarize_text", "Summarize a text into one sentence.", ["text"]),
    ("detect_language", "Detect the language of a text.", ["text"]),
    ("get_stock_quote", "Get the latest stock price for a ticker symbol.", ["ticker"]),
    ("get_company_info", "Get basic information about a company by name.", ["company"]),
    ("get_news_headlines", "Get the top five news headlines for a topic.", ["topic"]),
    ("lookup_postcode", "Get the city and region for a postcode.", ["postcode"]),
    ("validate_address", "Check whether a postal address is deliverable.", ["address"]),
    ("get_vat_number_status", "Check whether a VAT number is valid.", ["vat_number"]),
    ("get_invoice", "Get an invoice by invoice id.", ["invoice_id"]),
    ("list_invoices", "List unpaid invoices for a customer id.", ["customer_id"]),
    ("get_payment_methods", "List accepted payment methods for a country code.", ["country"]),
    ("get_bank_holiday_cutoff", "Get the payment cutoff time for a bank holiday date.", ["date"]),
    ("get_employee_directory", "Look up an employee's phone extension by name.", ["name"]),
    ("get_office_address", "Get the address of a company office by city.", ["city"]),
    ("book_meeting_room", "Book a meeting room for a date and hour.", ["date", "hour"]),
    ("get_parking_availability", "Get free parking spaces at an office by city.", ["city"]),
    ("get_exchange_fee", "Get the bank fee in percent charged for a currency exchange.", ["from_currency", "to_currency"]),
    ("get_shipping_zones", "List the countries in a shipping zone for a carrier.", ["carrier", "zone"]),
    ("get_carrier_rating", "Get the average customer rating of a carrier.", ["carrier"]),
    ("get_carbon_footprint", "Estimate CO2 in kg for shipping a weight in kg over a distance in km.", ["weight_kg", "distance_km"]),
    ("get_box_size_for_item", "Recommend a box size (small, medium, large) for an item.", ["item"]),
    ("get_bulk_discount", "Get the bulk discount percent for buying a number of units of an item.", ["item", "units"]),
    ("get_item_color_options", "List the available colors of a catalog item.", ["item"]),
    ("get_item_release_date", "Get the release date of a catalog item.", ["item"]),
    ("get_item_manual", "Get a link to the user manual of a catalog item.", ["item"]),
    ("check_item_compatibility", "Check whether two catalog items are compatible accessories.", ["item_a", "item_b"]),
    ("get_gift_wrap_price", "Get the gift wrap price for an order size.", ["size"]),
    ("get_store_inventory", "Get the units of an item in stock at a retail store by city.", ["item", "city"]),
    ("reserve_item", "Reserve units of an item for pickup at a store.", ["item", "city", "units"]),
    ("cancel_reservation", "Cancel an item reservation by id.", ["reservation_id"]),
    ("get_price_match_policy", "Get the price match policy text.", []),
    ("get_shipping_restrictions", "List items that a carrier refuses to ship.", ["carrier"]),
    ("get_dangerous_goods_class", "Get the dangerous goods class of an item, if any.", ["item"]),
    ("get_metric_prefixes", "List metric unit prefixes and their factors.", []),
    ("get_unit_definition", "Get the definition of a unit of measure.", ["unit"]),
    ("compare_numbers", "Return the larger of two numbers.", ["a", "b"]),
    ("sum_list", "Sum a comma-separated list of numbers.", ["numbers"]),
    ("average_list", "Average a comma-separated list of numbers.", ["numbers"]),
    ("get_random_number", "Return a random integer between two bounds.", ["low", "high"]),
    ("get_current_date", "Return today's date.", []),
    ("get_current_time", "Return the current time in a time zone.", ["zone"]),
    ("get_sunrise_time", "Get the sunrise time for a city.", ["city"]),
    ("get_air_quality", "Get the air quality index for a city.", ["city"]),
    ("get_item_material", "Get the main material of a catalog item.", ["item"]),
]
assert len(DISTRACTORS) == 95, len(DISTRACTORS)


def distractor_tools(env, k):
    out = []
    for name, desc, params in DISTRACTORS[:k]:
        def fn(_name=name, **kwargs):
            h = int(hashlib.md5((_name + json.dumps(kwargs, sort_keys=True)).encode()).hexdigest()[:6], 16)
            return {"tool": _name, "result": h % 997 / 10, "note": "illustrative value"}
        schema = create_model(f"{name}_args", **{p: (str, ...) for p in params})
        out.append(StructuredTool.from_function(func=env._wrap(name, fn), name=name, description=desc, args_schema=schema))
    return out


def tool_list_text(size):
    from env import DESCRIPTIONS
    items = [(n, DESCRIPTIONS[n]) for n in CORE if n != "submit_answer"] + [(n, d) for n, d, _ in DISTRACTORS[:size - 5]]
    items.sort()
    return "\n".join(f"- {n}: {d}" for n, d in items)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--models", required=True)
    ap.add_argument("--sizes", default="5,20,50,100")
    ap.add_argument("--selector", default="off,on")
    ap.add_argument("--harness", default="create_agent")
    ap.add_argument("--tasks", default="chain")
    ap.add_argument("--out", default="toolscale.jsonl")
    ap.add_argument("--max-tools", type=int, default=6)
    ap.add_argument("--max-tokens", type=int, default=1024)
    ap.add_argument("--run-token-cap", type=int, default=None)
    a = ap.parse_args()

    class Args:
        run_id = uuid.uuid4().hex[:8]
        cell_token_cap = 300000
        run_token_cap = a.run_token_cap
        tag = "toolscale"
    out = BENCH / "runs" / a.out
    done = set()
    if out.exists():
        for l in out.read_text().splitlines():
            r = json.loads(l)
            done.add((r["task_id"], r["model"], r["n_core_plus_distractors"], r["selector"]))
    tasks = load_tasks(a.tasks)
    log = open(BENCH / "logs" / "loads.log", "a")
    for spec in a.models.split(","):
        model, meta = make_model(spec, a.max_tokens)
        tagname = meta.get("tag") or meta.get("model")
        if meta["provider"] == "ollama":
            model.invoke("Say ok.")
        run_tokens = 0
        for size in map(int, a.sizes.split(",")):
            for sel in a.selector.split(","):
                Args.max_calls = 20 if sel != "off" else 10
                up = uptime()
                log.write(f"{time.strftime('%H:%M:%S')} toolscale block model={spec} size={size} selector={sel} :: {up}\n")
                log.flush()
                print(f"== {spec} size={size} selector={sel} {up}", flush=True)
                mwf = None
                if sel in ("on", "on_desc"):
                    from langchain.agents.middleware import LLMToolSelectorMiddleware
                    prompt = "Your goal is to select the most relevant tools for answering the user's query."
                    if sel == "on_desc":
                        prompt += "\n\nAvailable tools:\n" + tool_list_text(size)
                    mwf = lambda m, prompt=prompt: [LLMToolSelectorMiddleware(model=m, system_prompt=prompt, max_tools=a.max_tools, always_include=["submit_answer"])]
                for t in tasks:
                    if (t["id"], tagname, size, sel) in done:
                        continue
                    rng = random.Random(f"{t['id']}-{size}")

                    def order(tools, rng=rng):
                        tools = list(tools)
                        rng.shuffle(tools)
                        return tools
                    row = run_one(t, a.harness, model, meta, Args, 0, run_tokens_so_far=run_tokens, extra_tools=lambda env, k=size - 5: distractor_tools(env, k),
                                  tool_names=CORE, middleware_factory=mwf, tag="toolscale", order_fn=order)
                    run_tokens += row["in_tokens"] + row["out_tokens"]
                    row["n_core_plus_distractors"] = size
                    row["selector"] = sel
                    row["distractor_calls"] = sum(1 for n in row["tool_seq"] if n not in CORE)
                    with open(out, "a") as f:
                        f.write(json.dumps(row, default=str) + "\n")
                    print(f"{t['id']} n={size} sel={sel} {'PASS' if row['passed'] else 'fail'} {row['category'] or ''} calls={row['model_calls']} distract={row['distractor_calls']} tok={row['in_tokens']} {row['wall_s']:.1f}s", flush=True)


if __name__ == "__main__":
    main()
