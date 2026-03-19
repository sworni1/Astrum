"use client";

import { Input } from "@/components/ui/input";
import { categoryList } from "@/common/constants/category.list";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
} from "../../../../../components/ui/form";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";

type FormValues = {
  search_query: string;
  category: string;
};

const LaptopSearchbar = () => {
  const router = useRouter();

  const form = useForm<FormValues>({
    defaultValues: {
      search_query: "",
      category: "all",
    },
  });

  const { control, handleSubmit } = form;

  const handleSearch = (values: FormValues) => {
    const { category, search_query } = values;

    const url = `/categories/${category}/?search_query=${encodeURIComponent(
      search_query,
    )}`;

    router.push(url);
  };

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit(handleSearch)} className="inline-flex">
        <div className="hidden lg:flex w-md items-center gap-2 justify-center">
          <FormField
            name="search_query"
            control={control}
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Input
                    className="w-[287px]"
                    placeholder="Search..."
                    {...field}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            name="category"
            control={control}
            render={({ field }) => (
              <FormItem>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger className="w-[135px]">
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="all">All</SelectItem>
                      {categoryList.map((category, idx) => (
                        <SelectItem key={idx} value={category.href}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />
        </div>
      </form>
    </Form>
  );
};

export default LaptopSearchbar;
